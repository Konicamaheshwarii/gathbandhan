import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { FormArray, ReactiveFormsModule } from '@angular/forms';
import { MAX_PHOTOS } from '../../core/models';
import { resizeImage } from '../../shared/image';
import { ToastService } from '../../shared/toast.service';
import { PhotoForm, photoForm } from './wedding-form';

/**
 * Up to six couple photos. Each is resized on the device (900px, JPEG ~70%, usually 60–120 kB);
 * the backend uploads them to Supabase Storage on save, demo mode keeps the data URLs.
 */
@Component({
  selector: 'app-gallery-editor',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul class="photos">
      @for (p of photos().controls; track p.controls.id.value; let i = $index) {
        <li [formGroup]="p">
          <img [src]="p.controls.url.value" alt="" />
          <input type="text" formControlName="caption" placeholder="Caption (optional)" [attr.aria-label]="'Caption for photo ' + (i + 1)" />
          <button type="button" class="remove" (click)="photos().removeAt(i)" [attr.aria-label]="'Remove photo ' + (i + 1)">✕</button>
        </li>
      }
      @if (photos().length < max) {
        <li class="add">
          <label class="drop">
            <input type="file" accept="image/*" multiple class="sr-only" (change)="upload($event)" [disabled]="busy()" />
            @if (busy()) { <span class="spinner" aria-hidden="true"></span> } @else { <span aria-hidden="true">📷</span> }
            <span>Add photos</span>
            <span class="hint">{{ photos().length }}/{{ max }}</span>
          </label>
        </li>
      }
    </ul>
  `,
  styles: `
    .photos { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.6rem; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); }
    li { position: relative; display: grid; gap: 0.35rem; }
    img { width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 12px; display: block; }
    input[type='text'] { padding: 0.45rem 0.6rem !important; font-size: 16px; }
    .remove { position: absolute; top: 6px; right: 6px; width: 32px; height: 32px; border-radius: 50%; border: 0; background: rgb(0 0 0 / 55%); color: #fff; cursor: pointer; }
    .drop { aspect-ratio: 1; border: 2px dashed var(--border); border-radius: 12px; display: grid; place-content: center; justify-items: center; gap: 0.2rem; cursor: pointer; font-weight: 600; color: var(--muted); }
    .drop:hover, .drop:focus-within { border-color: var(--accent); color: var(--accent); }
    .drop span:first-of-type { font-size: 1.6rem; }
  `,
})
export class GalleryEditorComponent {
  private readonly toast = inject(ToastService);
  readonly photos = input.required<FormArray<PhotoForm>>();
  protected readonly max = MAX_PHOTOS;
  protected readonly busy = signal(false);

  protected async upload(event: Event): Promise<void> {
    const target = event.target as HTMLInputElement;
    const files = [...(target.files ?? [])].slice(0, MAX_PHOTOS - this.photos().length);
    this.busy.set(true);
    try {
      for (const file of files) this.photos().push(photoForm({ url: await resizeImage(file, 900, 0.7) }));
    } catch (e) {
      this.toast.show((e as Error).message);
    } finally {
      this.busy.set(false);
      target.value = '';
    }
  }
}
