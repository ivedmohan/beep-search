import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_COOKIE } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** POST /api/admin/logout: clears the admin cookie and redirects to the login page. */
export async function POST(req: Request) {
  const store = await cookies();
  store.set({ name: ADMIN_COOKIE, value: "", path: "/", maxAge: 0 });
  const ct = req.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) return NextResponse.json({ ok: true });
  return NextResponse.redirect(new URL("/admin/login", req.url), 303);
}
