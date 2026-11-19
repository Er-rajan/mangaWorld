import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { hasDatabase } from "./db";

export const sessionCookie = "nightfolio_admin";
export const sessionSeconds = 60 * 60 * 12;

export function adminConfigured() {
  return hasDatabase && Boolean(process.env.ADMIN_USERNAME
    && (process.env.ADMIN_PASSWORD?.length ?? 0) >= 16
    && (process.env.ADMIN_SESSION_SECRET?.length ?? 0) >= 32);
}

export function safeEqual(a: string, b: string) {
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(a), digest(b));
}

export function sign(value: string) {
  return createHmac("sha256", process.env.ADMIN_SESSION_SECRET!).update(value).digest("base64url");
}

function sessionSignature(expiry: string) {
  return sign(`session:${expiry}:${process.env.ADMIN_USERNAME}:${process.env.ADMIN_PASSWORD}`);
}

export function createSession() {
  const expiry = String(Math.floor(Date.now() / 1000) + sessionSeconds);
  return `${expiry}.${sessionSignature(expiry)}`;
}

export async function isAdmin() {
  if (!adminConfigured()) return false;
  const value = (await cookies()).get(sessionCookie)?.value ?? "";
  const [expiry, signature] = value.split(".");
  return Boolean(signature && /^\d+$/.test(expiry)
    && Number(expiry) > Date.now() / 1000 && safeEqual(signature, sessionSignature(expiry)));
}

export function sameOrigin(request: Request) {
  return request.headers.get("origin") === new URL(request.url).origin
    || request.headers.get("origin") === `https://${request.headers.get("host")}`
    || request.headers.get("origin") === `http://${request.headers.get("host")}`;
}
