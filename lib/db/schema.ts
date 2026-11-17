import {
  pgTable,
  serial,
  text,
  boolean,
  timestamp,
  integer,
  real,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

// ---- Enums kept as string unions (simpler migrations than pg enums) ----
export const SOURCE_KINDS = ["greenhouse", "lever", "ashby", "smartrecruiters"] as const;
export type SourceKind = (typeof SOURCE_KINDS)[number];

export const ROLES = [
  "software_engineering",
  "data_ml",
  "product",
  "design",
  "marketing",
  "sales_bd",
  "operations",
  "finance",
  "hr",
  "content",
  "customer_support",
  "research",
  "other",
] as const;
export type Role = (typeof ROLES)[number];

export const CITIES = [
  "bengaluru",
  "mumbai",
  "pune",
  "hyderabad",
  "chennai",
  "delhi_ncr",
  "kolkata",
  "ahmedabad",
  "remote",
  "multiple",
  "other_india",
] as const;
export type City = (typeof CITIES)[number];

export const JOB_TYPES = ["internship", "full_time", "unknown"] as const;
export type JobType = (typeof JOB_TYPES)[number];

export const sources = pgTable(
  "sources",
  {
    id: serial("id").primaryKey(),
    kind: text("kind").$type<SourceKind>().notNull(),
    token: text("token").notNull(),
    displayName: text("display_name").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastRunAt: timestamp("last_run_at", { withTimezone: true }),
    lastStatus: text("last_status"),
    lastError: text("last_error"),
    lastCount: integer("last_count"),
  },
  (t) => [uniqueIndex("sources_kind_token_idx").on(t.kind, t.token)],
);

export const jobs = pgTable(
  "jobs",
  {
    id: serial("id").primaryKey(),
    sourceId: integer("source_id")
      .notNull()
      .references(() => sources.id, { onDelete: "cascade" }),
    externalId: text("external_id").notNull(),
    title: text("title").notNull(),
    company: text("company").notNull(),
    locationRaw: text("location_raw").notNull().default(""),
    city: text("city").$type<City>(),
    role: text("role").$type<Role>(),
    jobType: text("job_type").$type<JobType>(),
    isFresher: boolean("is_fresher"),
    llmConfidence: real("llm_confidence"),
    llmModel: text("llm_model"),
    llmReason: text("llm_reason"),
    regexCandidate: boolean("regex_candidate").notNull().default(false),
    regexSignals: text("regex_signals"),
    descriptionText: text("description_text").notNull().default(""),
    applyUrl: text("apply_url").notNull(),
    postedAt: timestamp("posted_at", { withTimezone: true }),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    hiddenByAdmin: boolean("hidden_by_admin").notNull().default(false),
    dedupKey: text("dedup_key"),
    canonicalJobId: integer("canonical_job_id"),
    raw: jsonb("raw"),
  },
  (t) => [
    uniqueIndex("jobs_source_external_idx").on(t.sourceId, t.externalId),
    index("jobs_dedup_key_idx").on(t.dedupKey),
    index("jobs_open_fresher_idx").on(t.closedAt, t.isFresher),
  ],
);

export const ingestRuns = pgTable("ingest_runs", {
  id: serial("id").primaryKey(),
  sourceId: integer("source_id").references(() => sources.id, { onDelete: "set null" }),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  status: text("status").notNull().default("running"), // running | ok | error
  trigger: text("trigger").notNull().default("manual"), // cron | manual
  fetched: integer("fetched").notNull().default(0),
  indiaMatched: integer("india_matched").notNull().default(0),
  inserted: integer("inserted").notNull().default(0),
  updated: integer("updated").notNull().default(0),
  closed: integer("closed").notNull().default(0),
  llmTagged: integer("llm_tagged").notNull().default(0),
  error: text("error"),
});

export const llmCalls = pgTable("llm_calls", {
  id: serial("id").primaryKey(),
  runId: integer("run_id").references(() => ingestRuns.id, { onDelete: "set null" }),
  model: text("model").notNull(),
  postsCount: integer("posts_count").notNull(),
  inputTokens: integer("input_tokens").notNull(),
  outputTokens: integer("output_tokens").notNull(),
  cacheReadTokens: integer("cache_read_tokens").notNull().default(0),
  cacheWriteTokens: integer("cache_write_tokens").notNull().default(0),
  costUsd: real("cost_usd").notNull(),
  latencyMs: integer("latency_ms").notNull(),
  ok: boolean("ok").notNull().default(true),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const reviews = pgTable(
  "reviews",
  {
    id: serial("id").primaryKey(),
    jobId: integer("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    reviewer: text("reviewer").notNull().default("ved"),
    roleCorrect: boolean("role_correct"),
    cityCorrect: boolean("city_correct"),
    fresherCorrect: boolean("fresher_correct"),
    correctedRole: text("corrected_role").$type<Role>(),
    correctedCity: text("corrected_city").$type<City>(),
    correctedFresher: boolean("corrected_fresher"),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("reviews_job_idx").on(t.jobId)],
);

export type Source = typeof sources.$inferSelect;
export type Job = typeof jobs.$inferSelect;
export type NewJob = typeof jobs.$inferInsert;
export type IngestRun = typeof ingestRuns.$inferSelect;
export type LlmCall = typeof llmCalls.$inferSelect;
export type Review = typeof reviews.$inferSelect;
