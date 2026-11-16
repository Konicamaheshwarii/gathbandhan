import { ChangeDetectionStrategy, Component, output, signal } from '@angular/core';
import { canOpenUpiApps } from '../core/upi';
import { UPI_QR_MESSAGES, parseUpiQr } from '../core/upi-qr';
import { QrImageError, decodeQrImage } from './qr-decode';

export interface UpiFromQr {
  vpa: string;
  payeeName: string;
}

/**
 * "Upload your UPI QR": many couples know their QR (from GPay, PhonePe, Paytm or BHIM) but not
 * their UPI ID. The image is decoded on this device and dropped straight away; only the UPI ID
 * and name are kept, and only after the couple confirms them.
 */
@Component({
  selector: 'app-upi-qr-reader',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="qr-reader">
      <div class="row">
        <label class="btn small file-btn">
          <input type="file" accept="image/*" class="visually-hidden" data-test="upi-qr-file" (change)="read($event)" [disabled]="busy()" />
          <span aria-hidden="true">🔳</span> Upload your UPI QR
        </label>
        @if (onPhone) {
          <label class="btn small file-btn">
            <input type="file" accept="image/*" capture="environment" class="visually-hidden" (change)="read($event)" [disabled]="busy()" />
            <span aria-hidden="true">📷</span> Scan with camera
          </label>
        }
        @if (busy()) { <span class="hint"><span class="spinner" aria-hidden="true"></span> Reading the QR…</span> }
      </div>
      <p class="hint">Don't know your UPI ID? Use a screenshot of the “Receive money” QR in your UPI app. It is read on this device and never uploaded.</p>

      @if (error()) { <p class="alert small" role="alert">{{ error() }}</p> }

      @if (found(); as f) {
        <div class="found" role="status">
          <p>Found: <strong>{{ f.vpa }}</strong>@if (f.payeeName) { ({{ f.payeeName }})}, is this correct?</p>
          @if (merchant()) {
            <p class="hint">This looks like a shop or business QR. Guests will pay that account; use your personal QR if you meant to.</p>
          }
          <div class="row">
            <button type="button" class="btn small primary" (click)="confirm()">Yes, use it</button>
            <button type="button" class="btn small ghost" (click)="found.set(null)">No</button>
          </div>
        </div>
      }
    </div>
  `,
  styles: `
    .qr-reader { display: grid; gap: 0.4rem; }
    .row { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; }
    .file-btn { position: relative; cursor: pointer; }
    .file-btn:focus-within { outline: 2px solid var(--accent); outline-offset: 2px; }
    .visually-hidden { position: absolute; width: 1px; height: 1px; opacity: 0; overflow: hidden; clip: rect(0 0 0 0); }
    .hint, p { margin: 0; }
    .found { border: 1px solid var(--good); background: color-mix(in srgb, var(--good) 8%, var(--surface)); border-radius: 12px; padding: 0.6rem 0.8rem; display: grid; gap: 0.4rem; }
    strong { word-break: break-all; }
  `,
})
export class UpiQrReaderComponent {
  /** The couple confirmed the UPI ID (and name) read from their QR. */
  readonly confirmed = output<UpiFromQr>();

  protected readonly onPhone = canOpenUpiApps();
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly found = signal<UpiFromQr | null>(null);
  protected readonly merchant = signal(false);

  protected async read(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    // Forget the file at once: nothing about the image is kept.
    input.value = '';
    if (!file) return;
    this.busy.set(true);
    this.error.set('');
    this.found.set(null);
    try {
      const text = await decodeQrImage(file);
      const r = parseUpiQr(text);
      if (!r.ok) {
        this.error.set(UPI_QR_MESSAGES[r.reason]);
        return;
      }
      this.merchant.set(r.merchant);
      this.found.set({ vpa: r.vpa, payeeName: r.payeeName });
    } catch (e) {
      this.error.set(UPI_QR_MESSAGES[e instanceof QrImageError ? e.kind : 'unreadable']);
    } finally {
      this.busy.set(false);
    }
  }

  protected confirm(): void {
    const f = this.found();
    if (!f) return;
    this.confirmed.emit(f);
    this.found.set(null);
  }
}
