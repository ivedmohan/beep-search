# Beep Fresher Jobs — Build Plan

Deadline: **Fri 20 Nov 2026, 11:59 PM**. Today: Mon 17 Nov.
Judged on: 200+ real India fresher/internship posts, dedup, LLM role+city tags, searchable page,
auto-refresh, accuracy on 50 hand-checked posts, cost per 1,000 posts, 5-min Loom, repo, data sheet.
Everything else (admin polish, applied-tracking UX) is secondary. Build in that order.

## Decisions (made so far)

| Area | Decision | Why |
|---|---|---|
| Stack | Next.js 15 (App Router) on Vercel Hobby, TypeScript, Tailwind | Serverless, no separate backend |
| DB | Neon Postgres + Drizzle ORM | Free tier, branching, SQL we can show in the doc |
| Scheduler | GitHub Actions cron, every 6 h (`0 */6 * * *`) | No function timeout; runs `scripts/ingest.ts` against Neon directly |
| Manual refresh | Admin "Run now" button -> `POST /api/admin/ingest?source=<id>` one source per request, `maxDuration = 300` | Same code as the script, stays under Vercel Hobby 300 s |
| LLM | Claude Haiku 5.5 (`claude-haiku-5-5`), structured outputs, **10 posts per call** | $0.10/M in, $0.50/M out. You already have Claude credits. 10 per call keeps one bad response from poisoning 20 posts |
| Vectors / embeddings | **Not in MVP** | Dedup is deterministic (see below). Mention as stretch in video if asked |
| Filter | Hybrid: structured fields -> regex gate -> LLM | Regex does the bulk, LLM only on candidates |
| Stale posts | Soft close (`closed_at`), never hard delete | A failed fetch must not wipe data or the 50 hand-checked rows |
| Admin auth | One `ADMIN_PASSWORD` env + signed cookie, checked in `middleware.ts` for `/admin/*` and `/api/admin/*` | 15 lines, blocks the obvious |
| Applied tracking | `localStorage` only, no accounts | MVP; "Apply externally" opens job in new tab, on return show "Did you apply? Yes / No" |

Override anything here before Day 1 ends; after that it costs time.

## Sources

Measured live on 17 Nov: ATS boards alone give ~1–4% fresher posts (Razorpay 25/0, CRED 15/0,
Meesho 48/0, Sarvam 49/2, Freshworks India 29/0). **Adzuna is the volume source; ATS boards are the
precision/dedup source.**

### 1. Adzuna (aggregator, official API)
- How it works: sign up at developer.adzuna.com -> get `app_id` + `app_key` (instant, free).
- Endpoint: `GET https://api.adzuna.com/v1/api/jobs/in/search/{page}?app_id=..&app_key=..&what=fresher&where=india&max_days_old=30&results_per_page=50&sort_by=date`
- Run several queries: `what=fresher`, `what=internship`, `what=intern`, `what="graduate trainee"`, `what="entry level"`. Page until results empty or page 10.
- Response `results[]`: `id`, `title`, `company.display_name`, `location.display_name` + `location.area[]` (country > state > city), `description` (**a ~200-char snippet, not full JD**), `redirect_url`, `created`, `contract_time`, `category.label`.
- Terms: show "Adzuna" text/logo linked to adzuna.in on every Adzuna-sourced card. Free key is for non-commercial use; this project is an assessment, label it as such in the doc. Limits are shown in the account dashboard, not published; confirm "in" country is enabled when you sign up.
- Gotcha: snippet-only description means the LLM tags from title + snippet + location. Expect lower confidence than ATS posts.

### 2. Greenhouse — `GET https://boards-api.greenhouse.io/v1/boards/{token}/jobs?content=true`
- Public, no auth. Fields: `title`, `location.name` (free text), `content` (HTML), `absolute_url`, `updated_at`, `departments`, `offices`.
- Gotcha: tokens are weird. Razorpay = `razorpaysoftwareprivatelimited`. Wrong token = HTTP 404. Validate on add.

### 3. Lever — `GET https://api.lever.co/v0/postings/{site}?mode=json`
- Public. Fields: `text` (title), `categories.{location,commitment,team,allLocations}`, `country` (ISO, e.g. `IN` — use it for the India filter), `descriptionPlain`, `hostedUrl`, `applyUrl`, `createdAt`, `workplaceType`.
- Known working: `cred`, `meesho`. Gotcha: unknown site returns a non-array/HTML body, not a 404. Validate by checking `Array.isArray(body)`.

### 4. Ashby — `GET https://api.ashbyhq.com/posting-api/job-board/{name}`
- Public. Fields: `jobs[].title`, `location`, `secondaryLocations`, `employmentType` (`FullTime|PartTime|Intern|Contract|Temporary` — use `Intern` directly), `isRemote`, `workplaceType`, `descriptionPlain`, `jobUrl`, `applyUrl`, `publishedAt`.
- Known working: `sarvam`. Gotcha: unknown board returns non-JSON. Validate by parsing.

### 5. SmartRecruiters (optional, if time) — `GET https://api.smartrecruiters.com/v1/companies/{id}/postings?limit=100`
- Public. `content[].name`, `location.{city,country}`, `releasedDate`, `ref`. Known working: `freshworks` (120 posts, 29 India). Details need a second call per post; skip unless we need volume.

Seed list of ATS tokens to validate on Day 1 (kind:token): greenhouse:razorpaysoftwareprivatelimited,
lever:cred, lever:meesho, ashby:sarvam, smartrecruiters:freshworks. Find 15–25 more by Googling
`site:jobs.lever.co intern Bengaluru`, `site:jobs.ashbyhq.com Bengaluru`, `site:boards.greenhouse.io India`.

## Data model (Drizzle, Neon)

```
sources        id, kind (greenhouse|lever|ashby|smartrecruiters|adzuna), token (board slug or adzuna query),
               display_name, enabled, created_at, last_run_at, last_status, last_error, last_count
jobs           id, source_id, external_id, title, company, location_raw, city (enum), role (enum),
               job_type (internship|full_time|unknown), is_fresher bool, llm_confidence real,
               llm_model, llm_reason text, regex_candidate bool,
               description_text, apply_url, posted_at,
               first_seen_at, last_seen_at, closed_at, hidden_by_admin bool,
               dedup_key text, canonical_job_id (null = canonical), raw jsonb
               UNIQUE(source_id, external_id); INDEX(dedup_key); INDEX(closed_at, is_fresher)
ingest_runs    id, source_id, started_at, finished_at, status, fetched, inserted, updated, closed, llm_tagged, error
llm_calls      id, run_id, model, posts_count, input_tokens, output_tokens, cost_usd, latency_ms, created_at
reviews        id, job_id, reviewer, role_correct bool, city_correct bool, fresher_correct bool,
               corrected_role, corrected_city, corrected_fresher, note, created_at
```

Enums (fixed, so accuracy is measurable):
- `role`: software_engineering, data_ml, product, design, marketing, sales_bd, operations, finance, hr, content, customer_support, research, other
- `city`: bengaluru, mumbai, pune, hyderabad, chennai, delhi_ncr, kolkata, ahmedabad, remote, multiple, other_india
  (Delhi, Gurugram, Noida, Faridabad -> delhi_ncr. Bangalore -> bengaluru.)

## Ingest pipeline (per source, `lib/ingest/run.ts`)

1. **Fetch** via adapter -> `RawPost[]` (`externalId, title, company, locationRaw, country?, employmentType?, description, applyUrl, postedAt, raw`).
2. **India filter** (ATS only): Lever `country === 'IN'`; else regex on location: `india|bengaluru|bangalore|mumbai|pune|hyderabad|chennai|delhi|gurgaon|gurugram|noida|kolkata|ahmedabad|remote`. Drop non-India.
3. **Upsert** by `(source_id, external_id)`; set `last_seen_at = now()`, update title/description if changed.
4. **Soft close**: only if fetch succeeded, `UPDATE jobs SET closed_at = now() WHERE source_id = $1 AND closed_at IS NULL AND last_seen_at < run_started_at`.
5. **Regex gate** -> `regex_candidate`:
   - true if `employmentType === 'Intern'` OR title matches `/\b(intern|internship|fresher|graduate|trainee|entry[- ]level|campus|new grad|junior|associate|analyst)\b/i`
     OR description matches `/\b0\s*[-–to]+\s*[12]\s*(years?|yrs?)\b|\bfreshers?\b|\bno (prior )?experience\b|\brecent graduates?\b/i`.
   - false posts are stored with `is_fresher = false`, never sent to LLM (cheap; admin can spot-check what regex rejected).
6. **LLM tag** candidates where `llm_model IS NULL`, 10 per call, structured output (schema below). Log tokens to `llm_calls`.
7. **Dedup** across all open posts (`lib/dedup.ts`):
   - `dedup_key = normalize(company) + '|' + normalize(title) + '|' + city` where normalize = lowercase, strip punctuation/extra spaces, strip trailing "(Remote)", "- India", "Pvt Ltd", "Private Limited", "Inc".
   - Exact `apply_url` match also counts as duplicate.
   - Canonical = the ATS post if one exists (direct source beats aggregator), else earliest `first_seen_at`. Others get `canonical_job_id`.
   - Public listing shows canonical only; admin shows duplicate count per post.

Ordering matters: close before tag, tag before dedup (dedup uses `city`).

## LLM tagging (`lib/llm/tag.ts`)

- Model `claude-haiku-5-5`, `max_tokens` 2048, `output_config.format` JSON schema, `effort: low`.
- System prompt (cached, stable) holds the enums, the fresher rubric, 3 worked examples. User turn = JSON array of 10 posts `{id, title, company, location, description(<=1500 chars)}`.
- Output schema per post: `{ id, is_fresher: boolean, job_type: 'internship'|'full_time'|'unknown', role: enum, city: enum, confidence: 0-1, reason: string<=120 }`.
- Fresher rubric (write this in the doc too): internship, OR explicitly 0–1 years, OR fresher/graduate/trainee/campus in title, OR no experience requirement stated and title has no senior/lead/manager/II/III. "Associate"/"Analyst" alone is NOT enough; needs a description signal.
- Error handling: if the call fails or a post id is missing from output, retry that batch once, then fall back to single-post calls for the missing ids. Never leave `regex_candidate = true` rows untagged silently; `ingest_runs.error` must say so.
- Cost per call: `input_tokens * 0.10/1e6 + output_tokens * 0.50/1e6`. Expected ~1,100 in + ~80 out per post => **~$0.15 / 1,000 posts**. Report the real figure from `SELECT sum(cost_usd)/sum(posts_count)*1000 FROM llm_calls`.

## Scheduler

`.github/workflows/ingest.yml`: `on: schedule: cron '0 */6 * * *'` + `workflow_dispatch`. Steps: checkout, `pnpm i --frozen-lockfile`, `pnpm tsx scripts/ingest.ts`. Secrets: `DATABASE_URL`, `ANTHROPIC_API_KEY`, `ADZUNA_APP_ID`, `ADZUNA_APP_KEY`.
Gotchas: runs can be delayed 5–30 min under load, occasionally dropped, and scheduled workflows are disabled after 60 days of repo inactivity. Public repo = free minutes. Show `last_run_at` per source on the public page footer ("Last refreshed X hours ago") so the daily refresh is visible proof.

## Pages

### Public `/`
- Search box (title/company, Postgres `ILIKE` + trigram index), filters: role, city, job_type, source, posted within 7/30 days. Sort newest first. Pagination 24/page.
- Card: title, company, city chip, role chip, type chip, posted date, source badge (Adzuna cards carry the "Adzuna" attribution link), **Apply externally** button (new tab, `rel=noopener`).
- Applied tracking (`localStorage['beep.applied']` = `{[jobId]: 'clicked'|'yes'|'no'}`): on click set `clicked`; on `visibilitychange`/focus back, any `clicked` rows show inline "Did you apply? Yes / No"; `yes` shows a tick and a "Applied" filter toggle. No server calls.
- Footer: total open posts, last refresh time, source attribution.

### Admin `/admin` (password gate)
- **Sources**: table (kind, token, enabled, last run, status, count). Add form: pick kind, enter token -> `POST /api/admin/sources/validate` fetches the board and returns `{ok, postCount, sampleTitles[3]}` before saving. Reject on 404/non-JSON/empty. Duplicate (kind, token) rejected. Toggle enabled, delete source (soft: `enabled=false`; its jobs get closed).
- **Run now**: per source button and "Run all" (client loops sources sequentially, shows live counts from `ingest_runs`).
- **Jobs**: table with filters incl. `is_fresher`, `regex_candidate`, duplicates; actions: hide (`hidden_by_admin`), mark not-fresher, re-tag.
- **Review** `/admin/review`: pulls 50 random canonical, open, `is_fresher = true` posts (seeded so the set is stable), shows LLM tags + description, three correct/incorrect toggles + corrected value. Live accuracy: role %, city %, fresher %, overall. Export CSV -> this is the sheet for the submission.
- **Stats**: posts per source, LLM spend total and per 1,000, dedup count, last 10 runs.

## Repo layout

```
app/(public)/page.tsx            app/admin/{page,review}/...
app/api/admin/{sources,sources/validate,ingest,jobs}/route.ts
lib/db/{schema.ts,client.ts}     lib/sources/{greenhouse,lever,ashby,adzuna,smartrecruiters}.ts (+ index.ts registry)
lib/ingest/run.ts                lib/filter/{india,regex}.ts   lib/llm/{tag.ts,prompt.ts}   lib/dedup.ts
scripts/ingest.ts                .github/workflows/ingest.yml   middleware.ts   drizzle/
docs/SUBMISSION.md (data, prompts, accuracy, cost)   .env.example
```

## Build order

**Day 1 — Tue 18**: scaffold, Neon + Drizzle schema + migrations, all 4 adapters with a shared `RawPost` type, `scripts/ingest.ts` end to end *without* LLM (fetch, India filter, upsert, close, regex gate). Sign up Adzuna. Validate seed tokens. Target: 300+ India rows in Neon, 150+ regex candidates. Commit.
**Day 2 — Wed 19**: LLM tagging + `llm_calls` logging, dedup, public page with search/filters, GitHub Action live and one scheduled run observed. Deploy to Vercel. Target: 200+ open canonical fresher posts on the live URL.
**Day 3 — Thu 20 (day)**: admin (gate, sources + validate, run now, jobs, review page), applied tracking, attribution, footer. Do the 50-post hand check in `/admin/review`. Export CSV. Write `docs/SUBMISSION.md` with prompts, rubric, accuracy, cost query output.
**Day 3 night / Fri 21 morning**: Loom (architecture, what broke, numbers), submit. Keep 3+ hours buffer before 11:59 PM.

Note: the email says "Friday, 20 November" but 20 Nov 2026 is a Thursday. Treat **Thursday 20 Nov 11:59 PM** as the real deadline and Friday as bonus; ask Saurabh if you want certainty.

## Gotchas log (append as we hit them)

1. Greenhouse board tokens are not company names (Razorpay = `razorpaysoftwareprivatelimited`); 404 = wrong token.
2. Lever and Ashby return non-JSON / non-array for unknown boards instead of 404 — validate by shape.
3. Adzuna `description` is a short snippet; tag from title + snippet + location, expect lower confidence.
4. Vercel Hobby: cron once/day only, functions 300 s max. That's why ingest runs in GitHub Actions and "Run now" is per-source.
5. GitHub Actions cron: delays, occasional drops, auto-disabled after 60 days inactivity.
6. ATS boards are ~1–4% fresher posts; don't expect them to carry the 200 target.
7. Never close jobs for a source whose fetch failed this run.
8. Haiku 5.5: no server-side refusal fallback; handle `stop_reason === 'refusal'` by marking the batch for retry, not crashing.

## Submission checklist

- [ ] Live URL with 200+ open, deduped, tagged India fresher/intern posts
- [ ] "Last refreshed" visible on page, GitHub Actions run history public
- [ ] Repo public, README = this plan + how to run
- [ ] `docs/SUBMISSION.md`: sources + terms notes, rubric, prompts verbatim, accuracy table (50 rows), cost query output, what broke
- [ ] CSV export of 50 reviewed rows
- [ ] Loom <= 5 min, face + screen
- [ ] Submit at youform link before deadline
