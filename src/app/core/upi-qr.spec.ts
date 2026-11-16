import { decodeQrImage, QrImageError } from '../shared/qr-decode';
import { qrMatrix } from './qr';
import { buildUpiLink } from './upi';
import { parseUpiQr } from './upi-qr';

describe('parseUpiQr (couple uploads their UPI QR)', () => {
  it('reads Google Pay style QRs', () => {
    expect(parseUpiQr('upi://pay?pa=riya.sharma@okaxis&pn=Riya%20Sharma&aid=uGICAgIDFtM7yRQ')).toEqual({ ok: true, vpa: 'riya.sharma@okaxis', payeeName: 'Riya Sharma', merchant: false });
  });

  it('reads PhonePe style QRs (mc=0000 placeholder is personal)', () => {
    expect(parseUpiQr('upi://pay?pa=9876543210@ybl&pn=ARJUN%20MEHTA&mc=0000&mode=02&purpose=00')).toEqual({ ok: true, vpa: '9876543210@ybl', payeeName: 'ARJUN MEHTA', merchant: false });
  });

  it('reads Paytm style QRs and drops extras', () => {
    const r = parseUpiQr('upi://pay?pa=paytmqr281005050101xyz@paytm&pn=Paytm%20Merchant&paytmqr=281005050101XYZ&mc=5499&tr=ABC123');
    expect(r).toEqual({ ok: true, vpa: 'paytmqr281005050101xyz@paytm', payeeName: 'Paytm Merchant', merchant: true });
  });

  it('reads BHIM style QRs with empty params and a + in the name', () => {
    expect(parseUpiQr('upi://pay?pa=kavya@upi&pn=Kavya+Iyer&mc=&tid=&tr=&tn=&am=&cu=INR')).toEqual({ ok: true, vpa: 'kavya@upi', payeeName: 'Kavya Iyer', merchant: false });
  });

  it('handles an uppercase scheme and keys, URL-encoded Hindi names and stray whitespace', () => {
    expect(parseUpiQr('  UPI://PAY?PA=Riya.Arjun@OKHDFCBANK&PN=%E0%A4%B0%E0%A4%BF%E0%A4%AF%E0%A4%BE%20%E0%A4%B6%E0%A4%B0%E0%A5%8D%E0%A4%AE%E0%A4%BE  \n'))
      .toEqual({ ok: true, vpa: 'riya.arjun@okhdfcbank', payeeName: 'रिया शर्मा', merchant: false });
  });

  it('keeps only pa and pn from a merchant QR with amount, note and signature', () => {
    const r = parseUpiQr('upi://pay?pa=shop@icici&pn=Sharma%20Sweets&mc=5411&tr=TXN9&tn=Order%2042&am=499.00&cu=INR&sign=MEUCIQ');
    expect(r).toEqual({ ok: true, vpa: 'shop@icici', payeeName: 'Sharma Sweets', merchant: true });
  });

  it('keeps the first pa when a QR repeats it, and survives a broken escape', () => {
    expect(parseUpiQr('upi://pay?pa=first@ybl&pa=second@ybl&pn=Bad%E0%A4Name')).toEqual(jasmine.objectContaining({ ok: true, vpa: 'first@ybl' }));
  });

  it('works without a name', () => {
    expect(parseUpiQr('upi://pay?pa=dev@axl')).toEqual({ ok: true, vpa: 'dev@axl', payeeName: '', merchant: false });
  });

  it('round-trips the links Gathbandhan itself builds', () => {
    const link = buildUpiLink({ vpa: 'asha.dev@okaxis', payeeName: 'Asha & Dev', amount: 2100, note: 'Shagun' });
    expect(parseUpiQr(link)).toEqual({ ok: true, vpa: 'asha.dev@okaxis', payeeName: 'Asha & Dev', merchant: false });
  });

  it('explains what is wrong with other QRs', () => {
    expect(parseUpiQr('https://konicamaheshwarii.github.io/gathbandhan/#/w/riya-weds-arjun')).toEqual({ ok: false, reason: 'not-upi' });
    expect(parseUpiQr('WIFI:S:Home;T:WPA;P:secret;;')).toEqual({ ok: false, reason: 'not-upi' });
    expect(parseUpiQr('upi://mandate?pa=x@ybl')).toEqual({ ok: false, reason: 'not-upi' });
    expect(parseUpiQr('upi://pay?pn=Riya&am=100')).toEqual({ ok: false, reason: 'no-upi-id' });
    expect(parseUpiQr('upi://pay?pa=not-a-upi-id&pn=Riya')).toEqual({ ok: false, reason: 'bad-upi-id' });
    expect(parseUpiQr('')).toEqual({ ok: false, reason: 'not-upi' });
  });
});

describe('decodeQrImage (on-device, jsQR fallback)', () => {
  /** Draws a QR with the app's own generator onto a canvas, as a phone screenshot would show it. */
  async function qrPng(text: string, scale = 8, blur = 0): Promise<Blob> {
    const m = qrMatrix(text);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = m.size * scale + 80;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#f4efe6';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (blur) ctx.filter = `blur(${blur}px)`;
    ctx.translate(40, 40);
    ctx.scale(scale, scale);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, m.size, m.size);
    ctx.fillStyle = '#2a1613';
    ctx.fill(new Path2D(m.path));
    return new Promise((resolve) => canvas.toBlob((b) => resolve(b!), 'image/png'));
  }

  it('reads a UPI QR image without any network or upload', async () => {
    const link = 'upi://pay?pa=riya.sharma@okaxis&pn=Riya%20Sharma';
    expect(await decodeQrImage(await qrPng(link), { native: false })).toBe(link);
  });

  it('reports images without a QR, and files that are not images', async () => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 200;
    const blank = await new Promise<Blob>((r) => canvas.toBlob((b) => r(b!), 'image/png'));
    await expectAsync(decodeQrImage(blank, { native: false })).toBeRejectedWith(new QrImageError('no-qr'));
    await expectAsync(decodeQrImage(new Blob(['not an image'], { type: 'text/plain' }), { native: false })).toBeRejectedWith(new QrImageError('unreadable'));
  });

  it('reports a badly blurred QR as unreadable rather than guessing', async () => {
    await expectAsync(decodeQrImage(await qrPng('upi://pay?pa=a@ybl', 3, 6), { native: false })).toBeRejectedWith(new QrImageError('no-qr'));
  });
});
