import { z } from "zod";
import { sameOrigin } from "@/lib/admin-auth";
import { database, hasDatabase } from "@/lib/db";

const input = z.object({ id: z.uuid(), visitor: z.uuid(), liked: z.boolean() });

export async function POST(request: Request) {
  if (!sameOrigin(request)) return new Response(null, { status: 403 });
  if (!hasDatabase) return new Response(null, { status: 404 });
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return new Response(null, { status: 400 });
  const { id, visitor, liked } = parsed.data;
  const { data, error } = await database(true).rpc("react_to_reel", { target: id, browser: visitor, desired: liked });
  if (error) return new Response(null, { status: 503 });
  if (!data?.[0]) return new Response(null, { status: 404 });
  return Response.json(data[0], { headers: { "Cache-Control": "no-store" } });
}
