import { supabase } from "@/integrations/supabase/client";

const ONE_YEAR = 60 * 60 * 24 * 365;

export async function uploadToBucket(bucket: string, file: File, userId: string): Promise<string> {
  const ext = file.name.split(".").pop() || "bin";
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: false, contentType: file.type });
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
