import { ROLES, CITIES } from "@/lib/db/schema";

export const TAG_MODEL = "claude-haiku-5-5";

// Haiku 5.5 list price (USD per million tokens), prompts <= 100K tokens.
export const PRICE = { input: 0.1, output: 0.5, cacheRead: 0.01, cacheWrite: 0.125 };

/** Stable system prompt: keep byte-identical between calls so it caches. */
export const SYSTEM_PROMPT = `You classify job posts from Indian company career pages for a college-student job board (Beep). For each post decide whether a fresher can apply and tag its role and city.

## Fresher rubric (is_fresher = true when ANY holds)
1. It is an internship, apprenticeship, trainee or campus/graduate programme.
2. The minimum required experience is 0 or 1 year (e.g. "0-2 years", "1-3 years", "up to 2 years", "freshers welcome", "recent graduates").
3. No experience requirement is stated AND the title carries no seniority (no Senior/Lead/Staff/Principal/Manager/Head/Director/II/III) AND the responsibilities read as entry-level.
is_fresher = false when the minimum experience is 2+ years, or the title/description clearly targets experienced hires (Senior, Lead, Manager, "proven track record of N years", people management).
"Associate", "Analyst", "Executive", "Engineer I" alone are NOT enough: look for an experience signal in the description. If nothing is stated and the role is plausibly entry-level, say true with lower confidence.

## job_type
"internship" for internships/trainee stints with an end date or stipend; "full_time" for regular roles; "unknown" if unclear.

## role (pick exactly one)
${ROLES.map((r) => `- ${r}`).join("\n")}
Guidance: software_engineering = SWE/SDE/backend/frontend/mobile/QA/SRE/DevOps/security eng. data_ml = data analyst/scientist/engineer, ML/AI research engineer, analytics. product = PM/APM/product ops. design = UX/UI/graphic/visual. marketing = growth/brand/content marketing/SEO/performance. sales_bd = sales, BD, account exec, partnerships, pre-sales. operations = ops, supply chain, program/project coordination, founders office. finance = finance, accounting, FP&A, audit, tax, compliance (finance). hr = recruiting, talent, HR ops, L&D. content = writing, editorial, social media content, video. customer_support = support, success, implementation/onboarding specialist. research = research intern/scientist not primarily ML eng. other = everything else (legal, admin, facilities, teaching...).

## city (pick exactly one)
${CITIES.map((c) => `- ${c}`).join("\n")}
Mapping: Bangalore -> bengaluru. Delhi, New Delhi, Gurgaon, Gurugram, Noida, Faridabad, Ghaziabad -> delhi_ncr. Any other Indian city (Kolkata/Ahmedabad have their own) -> other_india. Fully remote (India) -> remote. Two or more Indian cities listed -> multiple. Hybrid counts as its city.

## Output
Return one entry per input post, same id, in the same order. confidence in [0,1]. reason: <= 20 words quoting the deciding signal (e.g. "0-2 years in requirements").`;

const REQ_RE =
  /[^.\n]{0,160}\b(\d+\s*\+?\s*(?:-|–|to)?\s*\d*\s*\+?\s*(?:years?|yrs)\b|years? of experience|experience required|fresher|graduat|entry[- ]level|new grad|must have|minimum qualifications?|requirements?:|qualifications?:)[^.\n]{0,160}/gi;

/** Sentences that state experience/qualification requirements, wherever they sit in the description. */
export function requirementSnippets(description: string, max = 900): string {
  const seen = new Set<string>();
  const out: string[] = [];
  let total = 0;
  for (const m of description.matchAll(REQ_RE)) {
    const t = m[0].replace(/\s+/g, " ").trim();
    if (t.length < 12 || seen.has(t)) continue;
    seen.add(t);
    if (total + t.length > max) break;
    out.push(t);
    total += t.length;
  }
  return out.join(" • ");
}

export function userPrompt(posts: { id: number; title: string; company: string; locationRaw: string; descriptionText: string }[]) {
  const items = posts.map((p) => ({
    id: p.id,
    title: p.title,
    company: p.company,
    location: p.locationRaw,
    description: p.descriptionText.slice(0, 2200),
    // Requirements often sit after the 2,200-char window (company boilerplate first). Surface them explicitly.
    requirement_lines: requirementSnippets(p.descriptionText),
  }));
  return `Classify these ${items.length} posts. "requirement_lines" are sentences extracted from the full description that mention experience or qualifications; trust them over the truncated description when they conflict:\n${JSON.stringify(items)}`;
}
