import { z } from "zod";

const uuid = z.uuid();
const title = z.string().trim().min(1, "Enter a title.").max(120);
const cover_id = uuid.nullable();
const edit = { id: uuid.nullable(), revision: z.number().int().min(0) };
const page = z.object({
  asset_id: uuid, width: z.number().int().min(1).max(6000), height: z.number().int().min(1).max(6000),
  filename: z.string().min(1).max(255), alt: z.string().max(400),
});

export const adminAction = z.discriminatedUnion("action", [
  z.object({ action: z.literal("login"), username: z.string().max(200), password: z.string().max(512) }),
  z.object({ action: z.literal("logout") }),
  z.object({ action: z.literal("upload") }),
  z.object({ action: z.literal("cleanup") }),
  z.object({ action: z.literal("delete"), kind: z.enum(["series", "chapter"]), id: uuid, revision: z.number().int().positive() }),
  z.object({ action: z.literal("series"), ...edit, payload: z.object({
    title, cover_id, description: z.string().max(6000),
    tags: z.array(z.string().trim().min(1).max(40)).max(20), status: z.enum(["ongoing", "completed"]),
  }) }),
  z.object({ action: z.literal("chapter"), ...edit, payload: z.object({
    series_id: uuid, title, cover_id, note: z.string().max(6000), published: z.boolean(),
    number: z.number().min(0).max(999999.99).refine((n) => Math.abs(n * 100 - Math.round(n * 100)) < 0.00001, "Use at most two decimals."),
    release_at: z.iso.datetime(), pages: z.array(page).max(250),
  }) }),
  z.object({ action: z.literal("settings"), payload: z.object({
    author: z.string().trim().max(100), about: z.string().max(6000),
    watermark: z.boolean(), comments: z.boolean(),
    characters: z.array(z.object({ name: z.string().trim().min(1, "Give each character a name.").max(100),
      series: z.string().max(120), bio: z.string().max(1600), image_id: cover_id.optional() })).max(30),
  }) }),
]);
