export type PostOptions = {
  link?: string;
  warning?: string;
  aspect?: "original" | "square" | "portrait" | "wide";
  attachments?: { kind: "image" | "video" | "audio" | "document"; name: string; description: string }[];
};

export function safePostLink(value: string): string | null {
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) ? url.href : null;
  } catch { return null; }
}

export function attachmentKind(file: Pick<File, "type">): "image" | "video" | "audio" | "document" {
  if (file.type.startsWith("audio/")) return "audio";
  if (file.type.startsWith("video/")) return "video";
  if (file.type === "application/pdf") return "document";
  return "image";
}

export function readPostOptions(value: unknown): PostOptions {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const data = value as Record<string, unknown>;
  const aspect = ["original", "square", "portrait", "wide"].includes(String(data.aspect)) ? data.aspect as PostOptions["aspect"] : "original";
  const attachments: NonNullable<PostOptions["attachments"]> = [];
  if (Array.isArray(data.attachments)) for (const raw of data.attachments) {
    if (!raw || typeof raw !== "object") continue;
    const a = raw as Record<string, unknown>;
    if (!["image", "video", "audio", "document"].includes(String(a.kind))) continue;
    attachments.push({ kind: a.kind as NonNullable<PostOptions["attachments"]>[number]["kind"], name: typeof a.name === "string" ? a.name : "Attachment", description: typeof a.description === "string" ? a.description : "" });
  }
  return { aspect, attachments, link: typeof data.link === "string" ? safePostLink(data.link) ?? undefined : undefined, warning: typeof data.warning === "string" ? data.warning : undefined };
}

export function mediaAspectClass(aspect: PostOptions["aspect"]) {
  if (aspect === "square") return "aspect-square object-contain";
  if (aspect === "portrait") return "aspect-[4/5] object-contain";
  if (aspect === "wide") return "aspect-video object-contain";
  return "object-contain";
}