"use client";

import { useRef } from "react";

/** Shrinks a photo to max 1280px JPEG so it uploads fast on mobile data. */
export async function compressImage(file: File, maxSide = 1280): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.82);
}

export const CameraIcon = () => (
  <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
    <circle cx="12" cy="13.5" r="3.5" />
  </svg>
);

/** Camera/gallery button. Calls onPick with a compressed data URL. */
export function PhotoButton({
  onPick,
  onError,
  disabled,
  className = "btn btn-ghost px-2.5",
}: {
  onPick: (dataUrl: string) => void;
  onError?: (msg: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <button
        type="button"
        className={className}
        disabled={disabled}
        onClick={() => input.current?.click()}
        aria-label="افزودن عکس (نسخه، رسید، قبض…)"
        title="عکس نسخه، رسید، قبض یا یادداشت"
      >
        <CameraIcon />
      </button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          try {
            onPick(await compressImage(file));
          } catch {
            onError?.("این عکس قابل خوندن نبود. یه عکس دیگه امتحان کن.");
          }
        }}
      />
    </>
  );
}

export function PhotoPreview({ src, onRemove }: { src: string; onRemove: () => void }) {
  return (
    <div className="relative inline-block">
      {/* eslint-disable-next-line @next/next/no-img-element -- local data URL preview */}
      <img src={src} alt="عکس انتخاب‌شده" className="h-20 w-20 rounded-xl border border-border object-cover" />
      <button
        type="button"
        onClick={onRemove}
        aria-label="حذف عکس"
        className="absolute -top-2 -left-2 grid size-6 place-items-center rounded-full bg-foreground text-xs text-background"
      >
        ×
      </button>
    </div>
  );
}
