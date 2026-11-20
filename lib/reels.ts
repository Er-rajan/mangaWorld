export type ReelCategory = { id: string; name: string };
export type Reel = {
  id: string; title: string; caption: string; category_id: string; tags: string[];
  youtube_id: string; chapter_path: string | null; published: boolean; likes: number;
};
export type ReelLink = { path: string; title: string };

export function youtubeVideoId(value: string) {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
    const host = url.hostname.replace(/^www\./, "");
    const [kind, video] = url.pathname.split("/").slice(1);
    const id = host === "youtu.be" ? kind : ["youtube.com", "m.youtube.com", "youtube-nocookie.com"].includes(host)
      ? kind === "watch" ? url.searchParams.get("v") : ["shorts", "embed", "live"].includes(kind) ? video : null : null;
    return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
  } catch { return null; }
}
