import { NextResponse } from "next/server";
import { SOURCE_KINDS, type SourceKind } from "@/lib/db/schema";
import { adapters } from "@/lib/sources";
import { isIndiaPost } from "@/lib/filter/india";
import { findSourceByKindToken, normalizeToken } from "@/lib/queries/admin";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/sources/validate
 * Body: `{ kind, token }`. Fetches the board through the adapter (nothing is written).
 * 200 `{ ok: true, kind, token (normalized), company, postCount, indiaCount, sampleTitles: string[], boardUrl, alreadyExists }`
 * 200 `{ ok: false, error }` when the board could not be fetched; 400 on bad input.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { kind?: unknown; token?: unknown };
  const kind = String(body.kind ?? "");
  if (!(SOURCE_KINDS as readonly string[]).includes(kind)) {
    return NextResponse.json({ ok: false, error: `kind must be one of ${SOURCE_KINDS.join(", ")}` }, { status: 400 });
  }
  const token = normalizeToken(kind as SourceKind, String(body.token ?? ""));
  if (!token || /[\s/]/.test(token)) {
    return NextResponse.json({ ok: false, error: "token must be a single board slug (no spaces or slashes)" }, { status: 400 });
  }
  const adapter = adapters[kind as SourceKind];
  const res = await adapter.fetchBoard(token);
  if (!res.ok) return NextResponse.json({ ok: false, error: res.error, kind, token });
  const india = res.posts.filter(isIndiaPost);
  const sampleTitles = (india.length ? india : res.posts).slice(0, 8).map((p) => `${p.title}${p.locationRaw ? ` — ${p.locationRaw}` : ""}`);
  const existing = await findSourceByKindToken(kind as SourceKind, token);
  return NextResponse.json({
    ok: true,
    kind,
    token,
    company: res.company,
    postCount: res.posts.length,
    indiaCount: india.length,
    sampleTitles,
    boardUrl: adapter.boardUrl(token),
    alreadyExists: !!existing,
  });
}
