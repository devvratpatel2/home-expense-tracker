// Phone photos are often 3-8 MB, over Vercel's upload limit. Images are scaled down to
// 2000px on the long side and re-encoded as JPEG before upload; PDFs go as they are.
async function shrinkImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.size < 1024 * 1024) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.82));
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch {
    return file;
  }
}

export async function uploadFile(file: File): Promise<string> {
  const fd = new FormData();
  fd.append('file', await shrinkImage(file));
  const res = await fetch('/api/upload', { method: 'POST', body: fd });
  const data = await res.json().catch(() => ({ error: res.status === 413 ? 'File is too large' : 'Upload failed' }));
  if (!res.ok) throw new Error(data.error || 'Upload failed');
  return data.path as string;
}
