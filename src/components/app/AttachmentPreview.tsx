import { useEffect, useState } from "react";
import { FileText, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { attachmentKind, mediaAspectClass, type PostOptions } from "@/lib/post-options";

export function AttachmentPreview({ file, description, onDescription, onRemove, aspect }: { file: File; description: string; onDescription: (value: string) => void; onRemove: () => void; aspect: PostOptions["aspect"] }) {
  const [url, setUrl] = useState("");
  useEffect(() => { const next = URL.createObjectURL(file); setUrl(next); return () => URL.revokeObjectURL(next); }, [file]);
  const kind = attachmentKind(file);
  return <div className="min-w-0 space-y-2 border-b py-3">
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2"><p className="truncate text-sm font-medium">{file.name}</p><Button variant="ghost" size="icon" aria-label={`Remove ${file.name}`} onClick={onRemove}><X /></Button></div>
    {kind === "audio" ? <audio src={url} controls preload="metadata" className="w-full" /> : kind === "document" ? <FileText className="size-8 text-primary" /> : kind === "video" ? <video src={url} controls className={`max-h-64 w-full bg-media ${mediaAspectClass(aspect)}`} /> : <img src={url} alt={description} className={`max-h-64 w-full bg-muted ${mediaAspectClass(aspect)}`} />}
    {kind === "image" && <input aria-label={`Image description for ${file.name}`} value={description} onChange={(e) => onDescription(e.target.value)} placeholder="Image description" maxLength={300} className="w-full rounded-md border bg-background px-3 py-2 text-sm" />}
  </div>;
}