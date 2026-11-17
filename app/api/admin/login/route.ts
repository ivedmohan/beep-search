import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, adminToken, passwordMatches } from "@/lib/auth";

export const dynamic = "force-dynamic";

const THIRTY_DAYS = 60 * 60 * 24 * 30;

/** Only allow same-origin relative paths as a post-login destination. */
function safeNext(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/admin/login")) return "/admin";
  return raw;
}

/**
 * POST /api/admin/login
 * Body: JSON `{ password, next? }` or form-encoded `password`, `next`.
 * JSON callers get `{ ok: true, next }` / `{ ok: false, error }` (401).
 * Form callers get a 303 redirect to `next` (or back to /admin/login?error=1 on failure).
 */
export async function POST(req: Request) {
  const ct = req.headers.get("content-type") ?? "";
  let password = "";
  let next = "/admin";
  let isJson = false;
  if (ct.includes("application/json")) {
    isJson = true;
    const body = (await req.json().catch(() => ({}))) as { password?: unknown; next?: unknown };
    password = typeof body.password === "string" ? body.password : "";
    next = safeNext(typeof body.next === "string" ? body.next : null);
  } else {
    const form = await req.formData().catch(() => null);
    password = String(form?.get("password") ?? "");
    next = safeNext(String(form?.get("next") ?? ""));
  }

  if (!passwordMatches(password)) {
    if (isJson) return NextResponse.json({ ok: false, error: "Wrong password" }, { status: 401 });
    const url = new URL("/admin/login", req.url);
    url.searchParams.set("error", "1");
    if (next !== "/admin") url.searchParams.set("next", next);
    return NextResponse.redirect(url, 303);
  }

  const store = await cookies();
  store.set({
    name: ADMIN_COOKIE,
    value: adminToken(),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: THIRTY_DAYS,
  });
  if (isJson) return NextResponse.json({ ok: true, next });
  return NextResponse.redirect(new URL(next, req.url), 303);
}
