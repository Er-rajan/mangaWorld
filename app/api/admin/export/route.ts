import { isAdmin } from "@/lib/admin-auth";
import { backup } from "@/lib/db";
import { reelCatalogue } from "@/lib/reels-server";

export async function GET() {
  if (!await isAdmin()) return new Response(null, { status: 401 });
  const [metadata, reels] = await Promise.all([backup(), reelCatalogue(true)]);
  const data = reels.available ? { ...metadata, reels: reels.clips, reel_categories: reels.categories } : metadata;
  return Response.json(data, { headers: {
    "Cache-Control": "private, no-store",
    "Content-Disposition": 'attachment; filename="manga-world-metadata.json"',
  } });
}
