import { z } from "zod";
import { isAdmin, sameOrigin } from "@/lib/admin-auth";
import { database } from "@/lib/db";
import { youtubeVideoId } from "@/lib/reels";

const id = z.uuid();
const action = z.discriminatedUnion("operation", [
  z.object({ operation: z.literal("save"), id: id.nullable(), title: z.string().trim().min(1).max(120),
    caption: z.string().trim().max(1000), youtube: z.string().trim().max(512), category_id: id,
    tags: z.array(z.string().trim().min(1).max(40)).max(12), published: z.boolean(),
    chapter_path: z.string().max(300).regex(/^\/(?:series\/[a-z0-9-]+|read\/[a-z0-9-]+\/[a-z0-9-]+)$/).nullable() }),
  z.object({ operation: z.literal("move"), id, direction: z.enum(["up", "down"]) }),
  z.object({ operation: z.literal("delete"), id }),
  z.object({ operation: z.literal("save-category"), id: id.nullable(), name: z.string().trim().min(1).max(40) }),
  z.object({ operation: z.literal("delete-category"), id }),
]);

export async function POST(request: Request) {
  if (!sameOrigin(request)) return new Response(null, { status: 403 });
  if (!await isAdmin()) return Response.json({ error: "Sign in to manage Reels." }, { status: 401 });
  const parsed = action.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Check the title, category, tags, and link." }, { status: 400 });
  const body = parsed.data;
  const { operation } = body;
  const youtube_id = operation === "save" ? youtubeVideoId(body.youtube) : undefined;
  if (operation === "save" && !youtube_id) return Response.json({ error: "Paste a valid HTTPS YouTube video or Shorts link." }, { status: 400 });
  const { error } = await database(true).rpc("mutate_reels", { operation, payload: { ...body, youtube_id } });
  if (error) {
    const message = error.code === "23503" ? "Check the category or reassign its reels before deleting it."
      : error.code === "23505" ? "That category name is already in use."
        : error.code === "22023" ? error.message : "Couldn’t save that change. Check the Reels migration and try again.";
    return Response.json({ error: message }, { status: 409 });
  }
  return Response.json({ ok: true });
}
