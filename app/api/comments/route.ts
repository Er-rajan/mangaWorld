import { createHmac } from "node:crypto";
import { z } from "zod";
import { sameOrigin } from "@/lib/admin-auth";
import { bundledChapter } from "@/lib/bundled-chapters";
import { commentLimits, type ChapterComment, type CommentPage } from "@/lib/comments";
import { database, hasDatabase, library } from "@/lib/db";
import { chapterLink } from "@/lib/format";

const pathSchema = z.string().max(220).regex(/^\/read\/[a-z0-9-]+\/[a-z0-9-]+$/);
const cursorSchema = z.string().regex(/^[1-9]\d{0,9}$/).transform(Number).pipe(z.number().max(2147483647));
const postSchema = z.object({
  requestId: z.uuid(),
  name: z.string().trim().min(1).max(commentLimits.name).regex(/^[^\x00-\x1F\x7F]+$/),
  body: z.string().trim().min(1).max(commentLimits.body).regex(/^[^\x00]+$/),
});
const pageSize = 20;
const noStore = { "Cache-Control": "no-store" };

async function findThread(request: Request) {
  if (!hasDatabase) return new Response(null, { status: 503 });
  const query = new URL(request.url).searchParams;
  const path = pathSchema.safeParse(query.get("chapter"));
  if (!path.success) return new Response(null, { status: 400 });
  const [, , slug, id] = path.data.split("/");
  const { series, settings, unavailable } = await library();
  if (unavailable) return new Response(null, { status: 503 });
  const title = series.find((entry) => entry.slug === slug);
  const chapter = title?.chapters.find((entry) => entry.id === id);
  if (!settings.comments || !title || !chapter) return new Response(null, { status: 404 });
  return { query, path: chapterLink(title, chapter), chapterId: bundledChapter(slug, id) ? null : chapter.id };
}

export async function GET(request: Request) {
  const thread = await findThread(request);
  if (thread instanceof Response) return thread;
  const cursor = cursorSchema.nullable().safeParse(thread.query.get("before"));
  if (!cursor.success) return new Response(null, { status: 400 });
  const { data, error } = await database(true).rpc("list_chapter_comments", {
    thread_path: thread.path, target: thread.chapterId, before_id: cursor.data, page_size: pageSize + 1,
  });
  if (error) {
    console.error("Could not read chapter comments:", error.code);
    return new Response(null, { status: 503 });
  }
  const rows: ChapterComment[] = data ?? [];
  const comments = rows.slice(0, pageSize);
  const page: CommentPage = { comments, next: rows.length > pageSize ? comments[pageSize - 1].id : null };
  return Response.json(page, { headers: noStore });
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return new Response(null, { status: 403 });
  const post = postSchema.safeParse(await request.json().catch(() => null));
  if (!post.success) return new Response(null, { status: 400 });
  const thread = await findThread(request);
  if (thread instanceof Response) return thread;
  const ip = process.env.VERCEL === "1" ? request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() : null;
  const source = ip ? createHmac("sha256", process.env.SUPABASE_SECRET_KEY!.trim()).update(`comments:${ip}`).digest("hex") : null;
  const { data, error } = await database(true).rpc("post_chapter_comment", {
    thread_path: thread.path, target: thread.chapterId, request_key: post.data.requestId,
    display_name: post.data.name, comment_body: post.data.body, source_key: source,
  });
  const comment: ChapterComment | undefined = data?.[0];
  if (error || !comment) {
    if (error?.code === "PT404") return new Response(null, { status: 404 });
    if (error?.code === "PT429") return new Response(null, { status: 429, headers: { "Retry-After": "60" } });
    if (error?.code === "PT409") return new Response(null, { status: 409 });
    console.error("Could not post a chapter comment:", error?.code ?? "No comment returned");
    return new Response(null, { status: 503 });
  }
  return Response.json(comment, { status: 201, headers: noStore });
}
