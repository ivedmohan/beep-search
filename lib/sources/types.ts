import type { SourceKind } from "@/lib/db/schema";

/** Normalised post shape every adapter must return. */
export interface RawPost {
  externalId: string;
  title: string;
  company: string;
  locationRaw: string;
  /** ISO-3166 alpha-2 when the ATS gives it (Lever `country`). */
  country?: string;
  /** ATS-provided employment type, e.g. Ashby "Intern", Lever commitment text. */
  employmentType?: string;
  description: string; // plain text
  applyUrl: string;
  postedAt?: Date;
  raw: unknown;
}

export interface FetchResult {
  ok: true;
  company: string;
  posts: RawPost[];
}
export interface FetchError {
  ok: false;
  error: string;
}

export interface SourceAdapter {
  kind: SourceKind;
  /** Fetch all published posts for a board token. Must not throw; return FetchError instead. */
  fetchBoard(token: string): Promise<FetchResult | FetchError>;
  /** Public URL of the hosted board, for admin links. */
  boardUrl(token: string): string;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;|&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)));
}

/** HTML -> plain text. Greenhouse returns entity-encoded HTML, so decode first (twice is harmless), then strip tags. */
export function htmlToText(html: string): string {
  let s = decodeEntities(html);
  if (/&(lt|gt|amp|nbsp|#\d+);/.test(s)) s = decodeEntities(s);
  return s
    .replace(/<\s*(br|p|div|li|h[1-6]|tr)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

export async function fetchJson(url: string, init?: RequestInit, attempt = 0): Promise<unknown> {
  try {
    const res = await fetch(url, {
      ...init,
      headers: { accept: "application/json", "user-agent": "beep-fresher-jobs/0.1 (+assessment project)", ...(init?.headers ?? {}) },
      signal: AbortSignal.timeout(25_000),
    });
    if (res.status >= 500 || res.status === 429) throw new Error(`HTTP ${res.status}`);
    if (!res.ok) return Promise.reject(new Error(`HTTP ${res.status}`));
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      throw new Error("non-JSON response");
    }
  } catch (e) {
    const msg = (e as Error).message ?? "";
    const retryable = /HTTP 5\d\d|HTTP 429|timeout|aborted|fetch failed|ECONNRESET|ETIMEDOUT/i.test(msg) || (e as Error).name === "TimeoutError";
    if (retryable && attempt < 2) {
      await new Promise((r) => setTimeout(r, 3_000 * (attempt + 1)));
      return fetchJson(url, init, attempt + 1);
    }
    throw e;
  }
}
