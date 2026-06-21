"use client";

/**
 * Downscale + re-encode an image in the browser before upload.
 * Keeps aspect ratio, caps the longest side, outputs JPEG/WebP.
 * Returns a new File (falls back to the original on any failure).
 */
export async function compressImage(
  file: File,
  opts: { maxSize?: number; quality?: number; mime?: string } = {}
): Promise<File> {
  const { maxSize = 1000, quality = 0.8, mime = "image/jpeg" } = opts;

  // Skip non-images and tiny files (< 200 KB) — not worth it.
  if (!file.type.startsWith("image/")) return file;
  if (file.size < 200 * 1024) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();

    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b), mime, quality)
    );
    if (!blob || blob.size >= file.size) return file; // no gain → keep original

    const ext = mime === "image/webp" ? "webp" : "jpg";
    const name = file.name.replace(/\.[^.]+$/, "") + "." + ext;
    return new File([blob], name, { type: mime });
  } catch {
    return file;
  }
}
