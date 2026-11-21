'use client';

import { useRef, useState } from 'react';
import { ImagePlus } from 'lucide-react';
import type { ActionResult } from '@/lib/form';
import { MAX_BRANCH_PHOTO_BYTES } from '@/lib/facilities';
import { useToast } from './Toast';

const MAX_SIDE = 1280;

/** Shrinks a picture so its longer side is at most 1280 px, as a JPEG under the size limit. */
async function shrink(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * scale);
    const h = Math.round(img.naturalHeight * scale);
    if (!w || !h) throw new Error('empty image');
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, w, h);
    for (const q of [0.82, 0.7, 0.55, 0.4]) {
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', q));
      if (blob && blob.size <= MAX_BRANCH_PHOTO_BYTES) return blob;
    }
    throw new Error('too large');
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** "Add photos" button: pick one or many pictures; each is resized and uploaded in turn. */
export function GalleryUploader({ upload, remaining }: { upload: (fd: FormData) => Promise<ActionResult>; remaining: number }) {
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);

  async function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).slice(0, remaining);
    e.target.value = '';
    if (!files.length) return;
    let ok = 0;
    const errors: string[] = [];
    for (const [i, file] of files.entries()) {
      setStatus(`Uploading ${i + 1} of ${files.length}…`);
      try {
        const blob = await shrink(file);
        const fd = new FormData();
        fd.set('photo', blob, 'photo.jpg');
        const r = await upload(fd);
        if (r.ok) ok++;
        else errors.push(r.error ?? 'Could not upload.');
      } catch {
        errors.push(`${file.name}: couldn't read this image (use JPG or PNG).`);
      }
    }
    setStatus(null);
    if (ok) toast(`${ok} photo${ok > 1 ? 's' : ''} added`);
    if (errors.length) toast(errors[0], 'error');
  }

  return (
    <>
      <button type="button" className="secondary-btn" onClick={() => input.current?.click()} disabled={!!status || remaining <= 0}>
        <ImagePlus size={15} /> {status ?? (remaining > 0 ? 'Add photos' : 'Photo limit reached')}
      </button>
      <input ref={input} type="file" accept="image/*" multiple hidden onChange={onFiles} />
    </>
  );
}
