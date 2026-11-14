/**
 * Shrinks an uploaded photo to a JPEG data URL so it fits comfortably in localStorage.
 * A cover at 1200px and quality 0.78 is typically 120-220 kB.
 */
export async function resizeImage(file: File, maxSide: number, quality = 0.78): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image file.');
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL('image/jpeg', quality);
}
