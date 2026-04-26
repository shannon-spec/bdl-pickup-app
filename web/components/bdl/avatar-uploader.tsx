"use client";

import { useRef, useState } from "react";
import { Upload, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const TARGET_DIM = 512; // square

/**
 * Client-side downscale + center-crop to TARGET_DIM × TARGET_DIM.
 * Keeps uploads small (≤~150 KB JPEG typically) without needing
 * server-side image processing.
 */
async function squareDownscale(file: File): Promise<Blob> {
  // GIFs would lose animation if we re-encoded, so leave them alone.
  if (file.type === "image/gif") return file;

  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const sx = (bitmap.width - side) / 2;
  const sy = (bitmap.height - side) / 2;

  const canvas = document.createElement("canvas");
  canvas.width = TARGET_DIM;
  canvas.height = TARGET_DIM;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, TARGET_DIM, TARGET_DIM);

  return new Promise<Blob>((resolve) =>
    canvas.toBlob(
      (b) => resolve(b ?? file),
      "image/jpeg",
      0.86,
    ),
  );
}

export function AvatarUploader({
  playerId,
  currentUrl,
  initials,
}: {
  playerId: string;
  currentUrl: string | null;
  initials: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Optimistic preview while the upload is in flight.
  const [preview, setPreview] = useState<string | null>(currentUrl);

  const onPick = () => inputRef.current?.click();

  const upload = async (file: File) => {
    setError(null);
    if (!ACCEPTED.includes(file.type)) {
      setError("Use a JPG, PNG, WEBP, or GIF.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError(`Image must be under ${MAX_BYTES / (1024 * 1024)} MB.`);
      return;
    }
    setPending(true);
    try {
      const localPreview = URL.createObjectURL(file);
      setPreview(localPreview);

      const downsized = await squareDownscale(file).catch(() => file);
      const form = new FormData();
      form.set(
        "file",
        new File([downsized], "avatar.jpg", { type: downsized.type }),
      );
      form.set("playerId", playerId);

      const res = await fetch("/api/upload-avatar", {
        method: "POST",
        body: form,
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        url?: string;
        error?: string;
      };
      if (!res.ok || !data.ok || !data.url) {
        setError(data.error ?? "Upload failed.");
        setPreview(currentUrl);
        return;
      }
      setPreview(data.url);
      router.refresh();
    } finally {
      setPending(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const onRemove = async () => {
    if (!preview) return;
    setError(null);
    setPending(true);
    try {
      const res = await fetch(
        `/api/upload-avatar?playerId=${encodeURIComponent(playerId)}`,
        { method: "DELETE" },
      );
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Could not remove.");
        return;
      }
      setPreview(null);
      router.refresh();
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex items-center gap-5 max-sm:flex-col max-sm:items-start">
      <div className="relative">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt="Avatar preview"
            className="w-24 h-24 rounded-full object-cover border border-[color:var(--hairline-2)] bg-[color:var(--surface-2)]"
          />
        ) : (
          <span
            className="w-24 h-24 rounded-full inline-flex items-center justify-center text-white font-extrabold text-[28px]"
            style={{
              background:
                "linear-gradient(135deg, var(--brand), var(--brand-2))",
            }}
          >
            {initials}
          </span>
        )}
        {pending && (
          <span className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center text-white text-[11px] font-semibold tracking-[0.08em] uppercase">
            Saving…
          </span>
        )}
      </div>

      <div className="flex flex-col gap-2 min-w-0">
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED.join(",")}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void upload(f);
          }}
        />
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={onPick}
            disabled={pending}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-[var(--r-lg)] bg-[color:var(--brand)] hover:bg-[color:var(--brand-hover)] text-white font-bold text-[12px] tracking-[0.06em] uppercase shadow-[var(--cta-shadow)] disabled:opacity-60"
          >
            <Upload size={14} strokeWidth={2.5} />
            {preview ? "Replace" : "Upload"}
          </button>
          {preview && (
            <button
              type="button"
              onClick={onRemove}
              disabled={pending}
              className="inline-flex items-center gap-2 h-10 px-3.5 rounded-[var(--r-lg)] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] text-[12px] font-medium text-[color:var(--down)] hover:bg-[color:var(--down-soft)] disabled:opacity-60"
            >
              <Trash2 size={14} /> Remove
            </button>
          )}
        </div>
        <div className="text-[11.5px] text-[color:var(--text-3)]">
          JPG / PNG / WEBP / GIF · up to 5 MB · auto-cropped to a square.
        </div>
        {error && (
          <div className="text-[12px] text-[color:var(--down)] bg-[color:var(--down-soft)] rounded-[var(--r-md)] px-3 py-2">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
