import { htmlToText } from "@/lib/sources/types";

const LOOKS_LIKE_HTML = /<\s*(p|div|br|li|ul|ol|h[1-6]|strong|em|b|i|span|a)\b[^>]*>/i;

/**
 * Greenhouse returns entity-encoded HTML, so after ingest's single `htmlToText` pass the stored text still holds
 * real tags. Re-run the strip only when the text looks like markup; plain-text sources (Lever, Ashby, SmartRecruiters)
 * pass through untouched apart from entity decoding.
 */
export function descriptionToText(stored: string): string {
  const text = LOOKS_LIKE_HTML.test(stored) ? htmlToText(stored) : stored;
  return text
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(Number.parseInt(h, 16)))
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/ /g, " ")
    .trim();
}
