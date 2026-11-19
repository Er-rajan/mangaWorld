import { artUrl } from "@/lib/format";

export function Art({ id, alt = "", full = false, eager = false, className, preview = false }: {
  id?: string | null; alt?: string; full?: boolean; eager?: boolean; className?: string; preview?: boolean;
}) {
  return <img src={artUrl(id, full ? "full" : "thumb", preview)} alt={alt} className={className}
    loading={eager ? "eager" : "lazy"} fetchPriority={eager ? "high" : "auto"} decoding="async" />;
}
