// shagun-delete-account: "Delete my account" from the account page.
// Deleting a Supabase auth user needs the service role, which never reaches the browser, so the
// app calls this function with the person's own session token. The token is checked here; the
// function only ever deletes the caller's own data.
//
// Body: { deleteWeddings: boolean }
//   • always: the profile row, the avatar files (avatars/<user id>/) and the auth user;
//   • deleteWeddings = true: every wedding page the caller owns alone, with its photos (guests,
//     RSVPs and shagun go with it through the foreign keys). On pages shared with co-owners the
//     caller is only removed as an owner, so a partner keeps the page.
//   • deleteWeddings = false: wedding pages are kept and stay listed under the caller's email, so
//     signing in again with that email (or a co-owner) can still manage them.
// Deploy with JWT verification off; this function verifies the token itself.
import { HttpError, admin, json, serve } from '../_shared/edge.ts';
import { isAllowedOrigin } from '../_shared/razorpay-core.ts';

const BUCKET = 'shagun-photos';

serve(async (req, origin) => {
  if (!isAllowedOrigin(origin)) throw new HttpError(403, 'Origin not allowed');
  const db = admin();

  // ---- who is calling?
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: auth } = token ? await db.auth.getUser(token) : { data: { user: null } };
  const user = auth.user;
  const email = user?.email?.toLowerCase();
  if (!user || !email) throw new HttpError(401, 'Please sign in again, then try once more.');
  const body = await req.json().catch(() => null) as { deleteWeddings?: unknown } | null;
  const deleteWeddings = body?.deleteWeddings === true;

  // ---- wedding pages
  let deleted = 0;
  let left = 0;
  if (deleteWeddings) {
    const { data: mine, error } = await db.from('shagun_wedding_owners').select('wedding_id').eq('email', email);
    if (error) throw new Error(error.message);
    for (const { wedding_id: weddingId } of (mine ?? []) as { wedding_id: string }[]) {
      const { count } = await db.from('shagun_wedding_owners').select('email', { count: 'exact', head: true }).eq('wedding_id', weddingId);
      if ((count ?? 0) <= 1) {
        await removeFolder(db, weddingId);
        const { error: e } = await db.from('shagun_weddings').delete().eq('id', weddingId);
        if (e) throw new Error(e.message);
        deleted++;
      } else {
        const { error: e } = await db.from('shagun_wedding_owners').delete().eq('wedding_id', weddingId).eq('email', email);
        if (e) throw new Error(e.message);
        left++;
      }
    }
  }

  // ---- profile, avatar, and the sign-in itself
  await removeFolder(db, `avatars/${user.id}`);
  const { error: profileError } = await db.from('shagun_profiles').delete().eq('id', user.id);
  if (profileError) throw new Error(profileError.message);
  const { error: userError } = await db.auth.admin.deleteUser(user.id);
  if (userError) throw new Error(userError.message);

  console.log(`Deleted an account (${deleted} wedding pages deleted, ${left} shared pages left).`);
  return json({ deleted: true, weddingsDeleted: deleted, weddingsLeft: left }, 200, origin);
});

/** Deletes every file directly inside one folder of the photo bucket (best effort, 1,000 at most). */
async function removeFolder(db: ReturnType<typeof admin>, folder: string): Promise<void> {
  const { data } = await db.storage.from(BUCKET).list(folder, { limit: 1000 });
  const paths = (data ?? []).filter((f) => f.id).map((f) => `${folder}/${f.name}`);
  if (paths.length) await db.storage.from(BUCKET).remove(paths);
}
