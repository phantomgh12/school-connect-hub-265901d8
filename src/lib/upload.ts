import { supabase } from "@/integrations/supabase/client";

const ONE_YEAR = 60 * 60 * 24 * 365;

const MAX_DIM = 1440;
const QUALITY = 0.72;

/**
 * Client-side image compression before upload.
 * Cuts typical phone photos from ~4MB to a few hundred KB, which massively
 * reduces both upload and download data for everyone in the feed.
 */
export async function compressImage(file: File): Promise<File> {
  if (typeof document === "undefined") return file;
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_DIM / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/webp", QUALITY));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".webp", { type: "image/webp" });
  } catch {
    return file;
  }
}

export async function uploadToBucket(bucket: string, file: File, userId: string): Promise<string> {
  const optimized = await compressImage(file);
  const ext = optimized.type === "image/webp" ? "webp" : optimized.name.split(".").pop() || "bin";
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(path, optimized, {
    upsert: false,
    contentType: optimized.type,
    cacheControl: String(ONE_YEAR),
  });
  if (error) throw error;
  const { data, error: sErr } = await supabase.storage.from(bucket).createSignedUrl(path, ONE_YEAR);
  if (sErr || !data) throw sErr ?? new Error("Failed to sign URL");
  return data.signedUrl;
}

export function extractHashtags(text: string): string[] {
  const set = new Set<string>();
  const re = /#([\p{L}0-9_]+)/gu;
  let m;
  while ((m = re.exec(text)) !== null) set.add(m[1].toLowerCase());
  return [...set];
}
