import { isAdmin } from "@/lib/admin-auth";
import { serveArt } from "@/lib/art-server";

export async function GET(_: Request, { params }: { params: Promise<{ id: string; variant: string }> }) {
  if (!await isAdmin()) return new Response(null, { status: 401 });
  const { id, variant } = await params;
  return serveArt(id, variant, true);
}
