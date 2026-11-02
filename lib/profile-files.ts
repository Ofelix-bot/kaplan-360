import { MAX_IMAGE_BYTES, MAX_IMAGE_EDGE, MAX_PDF_BYTES } from "@/lib/profile-reading";

// Files a student attaches to "Fill it in for me" (components/finder/sentence-fill.tsx), made ready in the
// browser before they are sent: images (HEIC too, where the browser can open it) are redrawn as JPEG no
// longer than MAX_IMAGE_EDGE on their longest side, so they are small and carry no photo metadata; PDFs
// are checked by their first bytes and size. The server checks everything again (app/api/profile).

export type PreparedFile = { file: File; kind: "image" | "pdf"; name: string };

/** Throws an Error whose message is an /api/profile error code ("bad-file", "too-big", "heic"). */
export async function prepareFile(file: File): Promise<PreparedFile> {
  const head = new Uint8Array(await file.slice(0, 5).arrayBuffer());
  if (String.fromCharCode(...head) === "%PDF-") {
    if (file.size > MAX_PDF_BYTES) throw new Error("too-big");
    return { file, kind: "pdf", name: file.name };
  }
  const heic = /hei[cf]$/i.test(file.name) || /hei[cf]/.test(file.type);
  if (!file.type.startsWith("image/") && !heic) throw new Error("bad-file");
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error(heic ? "heic" : "bad-file");
  }
  const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d")!;
  // Transparent screenshots read as white, not black, once they are JPEG.
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.88));
  if (!blob) throw new Error("bad-file");
  if (blob.size > MAX_IMAGE_BYTES) throw new Error("too-big");
  return { file: new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" }), kind: "image", name: file.name };
}
