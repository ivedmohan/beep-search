import { NextResponse } from "next/server";
import { SOURCE_KINDS, type SourceKind } from "@/lib/db/schema";
import { createSource, findSourceByKindToken, normalizeToken, setSourceEnabled, softDeleteSource } from "@/lib/queries/admin";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/sources
 * Body: `{ kind, token, displayName }`. Token is normalized (lowercase except Lever).
 * 201 `{ ok: true, source }`; 409 `{ ok: false, error }` for a duplicate kind+token; 400 on bad input.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { kind?: unknown; token?: unknown; displayName?: unknown };
  const kind = String(body.kind ?? "");
  if (!(SOURCE_KINDS as readonly string[]).includes(kind)) {
    return NextResponse.json({ ok: false, error: `kind must be one of ${SOURCE_KINDS.join(", ")}` }, { status: 400 });
  }
  const token = normalizeToken(kind as SourceKind, String(body.token ?? ""));
  if (!token || /[\s/]/.test(token)) {
    return NextResponse.json({ ok: false, error: "token must be a single board slug (no spaces or slashes)" }, { status: 400 });
  }
  const displayName = String(body.displayName ?? "").trim() || token;
  const existing = await findSourceByKindToken(kind as SourceKind, token);
  if (existing) {
    return NextResponse.json(
      { ok: false, error: `${kind}/${token} already exists as "${existing.displayName}" (id ${existing.id}, ${existing.enabled ? "enabled" : "disabled"})` },
      { status: 409 },
    );
  }
  try {
    const source = await createSource({ kind: kind as SourceKind, token, displayName });
    return NextResponse.json({ ok: true, source }, { status: 201 });
  } catch (e) {
    const msg = (e as Error).message;
    const status = /unique|duplicate/i.test(msg) ? 409 : 500;
    return NextResponse.json({ ok: false, error: status === 409 ? `${kind}/${token} already exists` : msg }, { status });
  }
}

/**
 * PATCH /api/admin/sources
 * Body: `{ id, action: "enable" | "disable" | "delete" }`.
 * "delete" is soft: sets enabled=false and closes all open jobs of the source.
 * 200 `{ ok: true, source, closed? }`; 404 if missing; 400 on bad input.
 */
export async function PATCH(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { id?: unknown; action?: unknown };
  const id = Number(body.id);
  const action = String(body.action ?? "");
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ ok: false, error: "id must be a positive integer" }, { status: 400 });
  if (action === "enable" || action === "disable") {
    const source = await setSourceEnabled(id, action === "enable");
    if (!source) return NextResponse.json({ ok: false, error: `source ${id} not found` }, { status: 404 });
    return NextResponse.json({ ok: true, source });
  }
  if (action === "delete") {
    const { source, closed } = await softDeleteSource(id);
    if (!source) return NextResponse.json({ ok: false, error: `source ${id} not found` }, { status: 404 });
    return NextResponse.json({ ok: true, source, closed });
  }
  return NextResponse.json({ ok: false, error: "action must be enable, disable or delete" }, { status: 400 });
}
