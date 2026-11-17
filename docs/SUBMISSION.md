# Submission notes — Beep Job Hub (fresher jobs & internships in India)

Live tool: _(Vercel URL)_ · Repo: https://github.com/ivedmohan/beep-search · Admin: `/admin`

All numbers below are copied from the database (queries at the bottom) for the first full run on **17 Nov 2026, 10:50–11:00 UTC**.
They move every 6 hours as the cron runs; the Stats page in admin shows the live values.

## 1. What it does
1. **Collect** — every 6 hours a GitHub Actions job (`.github/workflows/ingest.yml`) fetches 366 public ATS job boards
   (Greenhouse 240, Ashby 101, Lever 22, SmartRecruiters 3) through their documented public JSON endpoints.
2. **Filter to India** — Lever gives a `country` code; the others give a free-text location, matched against an India city/state list.
   "Remote" with no country is kept only if the description mentions India / INR.
3. **Regex gate** — a cheap veto for clearly senior posts (Senior/Lead/Staff/Manager/II/III in the title, or "N+ years of experience" with N ≥ 3)
   unless the post also carries an explicit fresher signal (intern, trainee, "0–1 years", "freshers", etc.). Everything else goes to the LLM.
4. **LLM tagging** — Claude Haiku 5.5 with structured outputs (`lib/llm/prompt.ts`, prompt reproduced in §5), 10 posts per call,
   returns `is_fresher`, `job_type`, `role` (13 values), `city` (11 values), `confidence`, `reason`.
5. **Dedup** — union-find over open posts on (a) normalised `company | title | city-or-raw-location` and (b) exact apply URL.
   The earliest-seen post is canonical; the rest are linked to it and hidden from the public list.
6. **Soft-close** — a post disappears from the board only when its own board was fetched *successfully* and the post was missing.
   A failed fetch never closes anything (this mattered: see §6).
7. **Serve** — Next.js 16 on Vercel, Neon Postgres. Public two-pane board with search + filters; admin for sources, runs, review, stats.

## 2. The numbers (first full run)

| Metric | Value |
|---|---|
| Boards fetched | 366 (361 returned posts) |
| Posts fetched (all countries) | 30,177 |
| India posts (open) | 4,279 |
| Vetoed by regex (never sent to LLM) | 3,086 |
| Sent to Haiku | 1,078 posts in 275 calls (0 failed) |
| Tagged fresher-eligible | 290 |
| **Public, deduped fresher posts** | **255** from 119 companies |
| Internship / full-time / unknown | 39 / 182 / 34 |
| Duplicate rows linked to a canonical post | 513 |

City split: Bengaluru 95 · Remote 48 · Pune 23 · Mumbai 22 · Other India 21 · Chennai 15 · Delhi NCR 14 · Multiple 10 · Hyderabad 7.
Role split: Operations 41 · Software Engineering 35 · Finance 33 · Customer Support 33 · Data/ML 28 · Sales/BD 21 · Other 15 · Content 14 · HR 12 · Marketing 8 · Research 8 · Product 5 · Design 2.

## 3. Cost per 1,000 posts

Model: `claude-haiku-5-5` at $0.10 / M input, $0.50 / M output, cache read $0.01 / M, cache write $0.125 / M.
Every call's `usage` is written to `llm_calls` and priced with those rates.

| | |
|---|---|
| Posts tagged | 1,078 |
| Input tokens (uncached) | 932,344 |
| Cache-read tokens | 469,287 (33% of prompt tokens served from cache) |
| Output tokens | 189,186 |
| Total spend | **$0.193** |
| **Cost per 1,000 LLM-tagged posts** | **$0.179** |
| Cost per 1,000 *fetched* India posts (regex veto included) | $0.045 |

Avg ≈ 1,715 prompt tokens and 188 output tokens per post. The system prompt (rubric + enums) is cached; only the 10-post payload is fresh each call.

## 4. Accuracy on 50 hand-checked posts

Done in `/admin/review`: a deterministic random sample of 50 public fresher posts (`ORDER BY md5(id || 'beep-review-seed')`), each marked
correct / wrong for role, city and fresher-eligibility, with the corrected value recorded. The page computes the percentages live and
"Export CSV" produces the sheet attached to the submission.

| Field | Correct / 50 | Accuracy |
|---|---|---|
| Role | _fill after review_ | |
| City | | |
| Fresher-eligible | | |
| All three | | |

## 5. The prompt (verbatim from `lib/llm/prompt.ts`)

System prompt (cached):

```
You classify job posts from Indian company career pages for a college-student job board (Beep). For each post decide whether a fresher can apply and tag its role and city.

## Fresher rubric (is_fresher = true when ANY holds)
1. It is an internship, apprenticeship, trainee or campus/graduate programme.
2. The minimum required experience is 0 or 1 year (e.g. "0-2 years", "1-3 years", "up to 2 years", "freshers welcome", "recent graduates").
3. No experience requirement is stated AND the title carries no seniority (no Senior/Lead/Staff/Principal/Manager/Head/Director/II/III) AND the responsibilities read as entry-level.
is_fresher = false when the minimum experience is 2+ years, or the title/description clearly targets experienced hires (Senior, Lead, Manager, "proven track record of N years", people management).
"Associate", "Analyst", "Executive", "Engineer I" alone are NOT enough: look for an experience signal in the description. If nothing is stated and the role is plausibly entry-level, say true with lower confidence.

## job_type
"internship" for internships/trainee stints with an end date or stipend; "full_time" for regular roles; "unknown" if unclear.

## role (pick exactly one)
software_engineering, data_ml, product, design, marketing, sales_bd, operations, finance, hr, content, customer_support, research, other
Guidance: software_engineering = SWE/SDE/backend/frontend/mobile/QA/SRE/DevOps/security eng. data_ml = data analyst/scientist/engineer, ML/AI research engineer, analytics. product = PM/APM/product ops. design = UX/UI/graphic/visual. marketing = growth/brand/content marketing/SEO/performance. sales_bd = sales, BD, account exec, partnerships, pre-sales. operations = ops, supply chain, program/project coordination, founders office. finance = finance, accounting, FP&A, audit, tax, compliance (finance). hr = recruiting, talent, HR ops, L&D. content = writing, editorial, social media content, video. customer_support = support, success, implementation/onboarding specialist. research = research intern/scientist not primarily ML eng. other = everything else (legal, admin, facilities, teaching...).

## city (pick exactly one)
bengaluru, mumbai, pune, hyderabad, chennai, delhi_ncr, kolkata, ahmedabad, remote, multiple, other_india
Mapping: Bangalore -> bengaluru. Delhi, New Delhi, Gurgaon, Gurugram, Noida, Faridabad, Ghaziabad -> delhi_ncr. Any other Indian city (Kolkata/Ahmedabad have their own) -> other_india. Fully remote (India) -> remote. Two or more Indian cities listed -> multiple. Hybrid counts as its city.

## Output
Return one entry per input post, same id, in the same order. confidence in [0,1]. reason: <= 20 words quoting the deciding signal (e.g. "0-2 years in requirements").
```

User turn: `Classify these N posts:` followed by a JSON array of `{id, title, company, location, description (first 2,500 chars)}`.
Output is constrained by a JSON schema (`output_config.format`, zod) with `effort: "low"`; a batch that comes back short is retried once, then per post.

## 6. What broke and how it was fixed
- **Board discovery was the real problem, not scraping.** A published list of "150 Indian companies on Greenhouse/Lever/Ashby" had 11 valid slugs out of 255.
  Fix: enumerate board slugs from the Common Crawl index for `jobs.ashbyhq.com`, `boards.greenhouse.io`, `job-boards.greenhouse.io`, verify every slug
  against the live API, keep boards with ≥1 India post → 366 boards (`scripts/discover.ts`, `data/seed-sources.tsv`).
- **ATS boards are only 1–4% fresher roles.** Fix: define fresher as "minimum experience ≤ 1 year", make the regex a senior-veto rather than a fresher-finder,
  and let the (cheap) LLM read descriptions. 1,078 LLM calls cost 19 cents.
- **Greenhouse descriptions were stored as raw HTML.** Greenhouse entity-encodes its HTML; the converter stripped tags before decoding entities. Fix: decode, then strip. Re-ingested.
- **Dedup collapsed same-title posts in different cities** before the LLM had tagged a city. Fix: fall back to the normalised raw location in the key.
- **Per-row upserts/updates against Neon took 14 minutes** (round-trip latency from India). Fix: chunked multi-row upserts and `UPDATE … FROM (VALUES …)` for dedup → ~3 minutes fetch + tagging.
- **Lever's postings API went down mid-build** (timeouts from two different networks while status.lever.co said "operational"). All 22 Lever boards errored.
  Nothing was closed because closing only happens after a successful fetch; added retry-with-backoff on 5xx/timeouts; the next cron run catches up.
- **A client component imported the Postgres driver** (`filtersToQuery` lived in a `"use client"` file that also exported server code). Fix: dependency-free module.
- **Next.js 16 surprises:** `middleware.ts` is now `proxy.ts`; `searchParams` is a Promise; Cache Components is on by default in new apps (turned off for predictable dynamic rendering).
- **Local DNS could not resolve the new Neon host** (home router) while public resolvers could. Local dev uses the IP + Neon's `options=endpoint` parameter; Vercel/GitHub use the hostname.

## 7. Terms of use
Greenhouse, Lever, Ashby and SmartRecruiters each publish a public, unauthenticated job-postings endpoint for exactly this purpose (embedding/listing
published jobs). We fetch each board at most every 6 hours, identify ourselves in the User-Agent, store only published posts, and every card links back to the original posting
("Apply externally"). No login-walled site (LinkedIn, Naukri, Internshala) is touched.

## 8. Queries behind the numbers
```sql
-- counts
select count(*) filter (where closed_at is null) open_india,
       count(*) filter (where closed_at is null and is_fresher and canonical_job_id is null and not hidden_by_admin) fresher_public,
       count(distinct company) filter (where closed_at is null and is_fresher and canonical_job_id is null) companies,
       count(*) filter (where closed_at is null and canonical_job_id is not null) duplicate_rows
from jobs;
-- cost
select count(*) calls, sum(posts_count) posts, sum(cost_usd) total_usd,
       sum(cost_usd)/sum(posts_count)*1000 usd_per_1000_posts
from llm_calls where ok;
-- accuracy (after hand-check)
select count(*) reviewed,
       avg(role_correct::int) role_acc, avg(city_correct::int) city_acc, avg(fresher_correct::int) fresher_acc,
       avg((role_correct and city_correct and fresher_correct)::int) overall_acc
from reviews;
```
