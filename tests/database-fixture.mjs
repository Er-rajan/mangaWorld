import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";

export async function openDatabase() {
  const db = new PGlite();
  // Supabase supplies these roles and Storage tables before project migrations run.
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role bypassrls;
    create schema storage;
    create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects (bucket_id text references storage.buckets(id), name text, primary key (bucket_id, name));
    grant usage on schema storage to service_role;
    grant all on all tables in schema storage to service_role;
  `);
  await db.exec(await readFile(new URL("../supabase/migrations/001_nightfolio.sql", import.meta.url), "utf8"));
  return db;
}

export function asRole(db, role, run) {
  return db.transaction(async (transaction) => {
    await transaction.exec(role === "service_role" ? "set local role service_role" : "set local role anon");
    return run(transaction);
  });
}
