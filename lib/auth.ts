import { createHmac, timingSafeEqual } from "node:crypto";

export const ADMIN_COOKIE = "beep_admin";

function secret() {
  return process.env.ADMIN_SECRET ?? process.env.ADMIN_PASSWORD ?? "dev-secret";
}
export function adminToken(): string {
  return createHmac("sha256", secret()).update("admin-session-v1").digest("hex");
}
export function isValidAdminToken(token: string | undefined): boolean {
  if (!token) return false;
  const a = Buffer.from(token);
  const b = Buffer.from(adminToken());
  return a.length === b.length && timingSafeEqual(a, b);
}
export function passwordMatches(input: string): boolean {
  const expected = process.env.ADMIN_PASSWORD ?? "";
  if (!expected) return false;
  const a = Buffer.from(input);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
