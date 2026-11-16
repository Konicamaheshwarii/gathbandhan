import { isValidVpa, normalizeVpa } from './upi';

/**
 * Reading the couple's own UPI QR (the one GPay, PhonePe, Paytm or BHIM shows under "Receive
 * money"), so they do not have to know their UPI ID. Only `pa` (the UPI ID) and `pn` (the name)
 * are kept; amounts, notes, merchant codes, signatures and app-specific extras are dropped.
 */
export type UpiQrResult =
  | { ok: true; vpa: string; payeeName: string; merchant: boolean }
  | { ok: false; reason: UpiQrProblem };

export type UpiQrProblem = 'not-upi' | 'no-upi-id' | 'bad-upi-id';

export const UPI_QR_MESSAGES: Record<UpiQrProblem | 'no-qr' | 'unreadable', string> = {
  'no-qr': 'We could not find a QR code in that image. Try a sharper screenshot of your UPI app’s QR, with the whole code visible.',
  unreadable: 'That file could not be opened as an image. Use a PNG or JPG screenshot or photo.',
  'not-upi': 'That QR code is not a UPI payment QR. In your UPI app, open “Receive money” or “My QR” and use that one.',
  'no-upi-id': 'That QR has no UPI ID in it. Use the “Receive money” QR from your UPI app.',
  'bad-upi-id': 'The UPI ID in that QR does not look right. Check it in your UPI app and type it in instead.',
};

/** Percent-decodes leniently: `+` as a space (as some apps write names) and broken escapes kept. */
function decodeParam(value: string): string {
  const v = value.replace(/\+/g, ' ');
  try {
    return decodeURIComponent(v);
  } catch {
    return v.replace(/%20/gi, ' ');
  }
}

export function parseUpiQr(payload: string): UpiQrResult {
  const text = (payload ?? '').trim();
  const m = /^upi:\/\/pay\/?\?(.*)$/is.exec(text);
  if (!m) return { ok: false, reason: 'not-upi' };

  const params = new Map<string, string>();
  for (const part of m[1].split('&')) {
    const eq = part.indexOf('=');
    if (eq <= 0) continue;
    const key = part.slice(0, eq).trim().toLowerCase();
    // The first value wins, so a later duplicate cannot swap the payee.
    if (!params.has(key)) params.set(key, decodeParam(part.slice(eq + 1)).trim());
  }

  const rawVpa = params.get('pa') ?? '';
  if (!rawVpa) return { ok: false, reason: 'no-upi-id' };
  const vpa = normalizeVpa(rawVpa);
  if (!isValidVpa(vpa)) return { ok: false, reason: 'bad-upi-id' };

  const payeeName = (params.get('pn') ?? '').replace(/\s+/g, ' ').trim().slice(0, 60);
  const mc = params.get('mc') ?? '';
  // Personal QRs carry no merchant code, or the "0000" placeholder; shops carry a real one.
  const merchant = (!!mc && mc !== '0000') || !!params.get('tr') || !!params.get('sign');
  return { ok: true, vpa, payeeName, merchant };
}
