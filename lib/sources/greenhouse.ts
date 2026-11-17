import { fetchJson, htmlToText, type SourceAdapter } from "./types";

interface GhJob {
  id: number;
  title: string;
  updated_at?: string;
  first_published?: string;
  location?: { name?: string };
  absolute_url: string;
  content?: string;
  company_name?: string;
}

export const greenhouse: SourceAdapter = {
  kind: "greenhouse",
  boardUrl: (t) => `https://job-boards.greenhouse.io/${t}`,
  async fetchBoard(token) {
    try {
      const data = (await fetchJson(
        `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(token)}/jobs?content=true`,
      )) as { jobs?: GhJob[] };
      if (!data || !Array.isArray(data.jobs)) return { ok: false, error: "unexpected shape (no jobs[])" };
      const company = data.jobs[0]?.company_name ?? token;
      return {
        ok: true,
        company,
        posts: data.jobs.map((j) => ({
          externalId: String(j.id),
          title: j.title?.trim() ?? "",
          company: j.company_name ?? company,
          locationRaw: j.location?.name ?? "",
          description: htmlToText(j.content ?? ""),
          applyUrl: j.absolute_url,
          postedAt: j.first_published ? new Date(j.first_published) : j.updated_at ? new Date(j.updated_at) : undefined,
          raw: { ...j, content: undefined },
        })),
      };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  },
};
