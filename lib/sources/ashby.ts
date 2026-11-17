import { fetchJson, type SourceAdapter } from "./types";

interface AshbyJob {
  id: string;
  title: string;
  location?: string;
  secondaryLocations?: { location?: string }[];
  employmentType?: string;
  isRemote?: boolean;
  workplaceType?: string;
  descriptionPlain?: string;
  jobUrl: string;
  applyUrl?: string;
  publishedAt?: string;
  isListed?: boolean;
}

export const ashby: SourceAdapter = {
  kind: "ashby",
  boardUrl: (t) => `https://jobs.ashbyhq.com/${t}`,
  async fetchBoard(token) {
    try {
      const data = (await fetchJson(`https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(token)}`)) as {
        jobs?: AshbyJob[];
      };
      if (!data || !Array.isArray(data.jobs)) return { ok: false, error: "unexpected shape (no jobs[])" };
      const posts = data.jobs
        .filter((j) => j.isListed !== false)
        .map((j) => ({
          externalId: j.id,
          title: j.title?.trim() ?? "",
          company: token,
          locationRaw: [j.location, ...(j.secondaryLocations ?? []).map((s) => s.location)]
            .filter(Boolean)
            .join(", ")
            .concat(j.workplaceType ? ` (${j.workplaceType})` : ""),
          employmentType: j.employmentType,
          description: (j.descriptionPlain ?? "").trim(),
          applyUrl: j.jobUrl ?? j.applyUrl ?? "",
          postedAt: j.publishedAt ? new Date(j.publishedAt) : undefined,
          raw: { ...j, descriptionPlain: undefined, descriptionHtml: undefined },
        }));
      return { ok: true, company: token, posts };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  },
};
