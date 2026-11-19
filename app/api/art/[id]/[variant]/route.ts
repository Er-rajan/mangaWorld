import { serveArt } from "@/lib/art-server";

export async function GET(_: Request, { params }: { params: Promise<{ id: string; variant: string }> }) {
  const { id, variant } = await params;
  return serveArt(id, variant);
}
