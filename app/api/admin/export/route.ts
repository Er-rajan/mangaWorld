import { isAdmin } from "@/lib/admin-auth";
import { backup } from "@/lib/db";

export async function GET() {
  if (!await isAdmin()) return new Response(null, { status: 401 });
  return Response.json(await backup(), { headers: {
    "Cache-Control": "private, no-store",
    "Content-Disposition": 'attachment; filename="manga-world-metadata.json"',
  } });
}
