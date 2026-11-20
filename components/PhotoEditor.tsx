'use client';

import { useRef, useState } from 'react';
import { Camera } from 'lucide-react';
import type { ActionResult } from '@/lib/form';
import { avatarClass, initials } from '@/lib/format';
import { MAX_PHOTO_BYTES } from '@/lib/photos';

const SIZE = 320;

/** Crops the picture to a centred square and shrinks it to a small JPEG before upload. */
async function shrink(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    if (!side) throw new Error('empty image');
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = SIZE;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff'; // transparent PNGs get a white background
    ctx.fillRect(0, 0, SIZE, SIZE);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, SIZE, SIZE);
    for (const quality of [0.85, 0.7, 0.55]) {
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', quality));
      if (blob && blob.size <= MAX_PHOTO_BYTES) return blob;
    }
    throw new Error('too large');
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Big avatar with "Add / Change photo" and "Remove". Works in the staff app and the parent app. */
export function PhotoEditor({
  name,
  photo,
  upload,
  remove,
}: {
  name: string;
  photo: string | null;
  upload: (fd: FormData) => Promise<ActionResult>;
  remove: () => Promise<ActionResult>;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setMsg(null);
    setBusy(true);
    try {
      const blob = await shrink(file);
      const fd = new FormData();
      fd.set('photo', blob, 'photo.jpg');
      const r = await upload(fd);
      setMsg(r.ok ? { text: r.message ?? 'Photo updated', ok: true } : { text: r.error ?? 'Could not save the photo.', ok: false });
    } catch {
      setMsg({ text: "Couldn't read this image. Please choose a JPG or PNG photo.", ok: false });
    }
    setBusy(false);
  }

  async function onRemove() {
    if (!window.confirm(`Remove ${name}'s photo?`)) return;
    setBusy(true);
    try {
      const r = await remove();
      setMsg(r.ok ? { text: r.message ?? 'Photo removed', ok: true } : { text: r.error ?? 'Could not remove the photo.', ok: false });
    } catch {
      setMsg({ text: 'Could not reach the server. Please try again.', ok: false });
    }
    setBusy(false);
  }

  return (
    <div className="photo-editor">
      <button type="button" className={`avatar player big ${avatarClass(name)} ${photo ? 'has-photo' : ''}`} onClick={() => input.current?.click()} disabled={busy} title={photo ? 'Change photo' : 'Add photo'}>
        {photo ? <img src={photo} alt={`${name}'s photo`} /> : initials(name)}
        <span className="photo-badge" aria-hidden><Camera size={12} /></span>
      </button>
      <div className="photo-actions">
        <button type="button" className="text-btn" onClick={() => input.current?.click()} disabled={busy}>
          {busy ? 'Saving…' : photo ? 'Change photo' : 'Add photo'}
        </button>
        {photo && !busy && <button type="button" className="text-btn subtle" onClick={onRemove}>Remove</button>}
      </div>
      {msg && <small className={msg.ok ? 'c-present' : 'c-absent'} role="status">{msg.text}</small>}
      <input ref={input} type="file" accept="image/*" hidden onChange={onFile} />
    </div>
  );
}
