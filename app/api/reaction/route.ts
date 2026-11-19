import { z } from "zod";
import { sameOrigin } from "@/lib/admin-auth";
import { database, hasDatabase } from "@/lib/db";

const schema = z.object({ id: z.uuid(), visitor: z.uuid(), action: z.enum(["view", "like"]), liked: z.boolean() });

export async function POST(request: Request) {
  if (!sameOrigin(request)) return new Response(null, { status: 403 });
  if (!hasDatabase) return new Response(null, { status: 404 });
  const input = schema.safeParse(await request.json().catch(() => null));
  if (!input.success) return new Response(null, { status: 400 });
  const { id, visitor, action, liked } = input.data;
  const { data, error } = await database(true).rpc("track_chapter", { target: id, browser_id: visitor, action, reaction: liked });
  if (error) return new Response(null, { status: 503 });
  if (!data?.[0]) return new Response(null, { status: 404 });
  return Response.json(data[0], { headers: { "Cache-Control": "no-store" } });
}
