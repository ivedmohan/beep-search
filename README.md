# Beep Job Hub — fresher jobs & internships in India

Live tool built for Beep's Gen AI & Engineering assessment. It collects fresher/internship posts in India from
public ATS job-board APIs (Greenhouse, Lever, Ashby, SmartRecruiters), de-duplicates them, tags each post by
role and city with Claude Haiku, and shows them on a searchable Beep-style page that refreshes itself every 6 hours.

- Plan and decisions: `PLAN.md` · Design tokens: `DESIGN.md` · Submission notes (prompts, accuracy, cost): `docs/SUBMISSION.md`

## Stack
Next.js 16 (App Router) on Vercel · Neon Postgres + Drizzle · GitHub Actions cron · Claude Haiku 5.5 (structured outputs)

## Run locally
```bash
pnpm install
cp .env.example .env   # fill DATABASE_URL, ANTHROPIC_API_KEY, ADMIN_PASSWORD, ADMIN_SECRET
pnpm db:push           # create tables
pnpm seed              # load data/seed-sources.tsv (366 boards with India posts)
pnpm ingest            # fetch -> India filter -> regex gate -> Haiku tags -> dedup   (add --no-llm to skip tagging)
pnpm dev
```
Public board: `/` · Admin (password): `/admin` — sources, run now, jobs, 50-post review, stats.

## Pipeline (per source, `lib/ingest/run.ts`)
fetch board → keep India posts (`lib/filter/india.ts`) → chunked upsert → soft-close posts missing from a *successful* fetch →
regex gate vetoes clearly senior posts (`lib/filter/regex.ts`) → Haiku tags the rest, 10 posts per call, cost logged per call (`lib/llm/`) →
dedup across open posts on normalised company|title|city and exact apply URL (`lib/dedup.ts`).

## Scheduler
`.github/workflows/ingest.yml` runs `scripts/ingest.ts` every 6 hours (secrets: `DATABASE_URL`, `ANTHROPIC_API_KEY`).
