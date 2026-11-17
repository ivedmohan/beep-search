import { fetchJson, type SourceAdapter, type RawPost } from "./types";

interface SrPosting {
  id: string;
  name: string;
  releasedDate?: string;
  location?: { city?: string; region?: string; country?: string; remote?: boolean };
  company?: { identifier?: string; name?: string };
  typeOfEmployment?: { label?: string };
  experienceLevel?: { label?: string };
  ref: string;
}

/**
 * SmartRecruiters public posting API. The list endpoint has no description;
 * we only include India posts and fetch details for those (one call each).
 */
export const smartrecruiters: SourceAdapter = {
  kind: "smartrecruiters",
  boardUrl: (t) => `https://jobs.smartrecruiters.com/${t}`,
  async fetchBoard(token) {
    try {
      const all: SrPosting[] = [];
      let offset = 0;
      for (let page = 0; page < 10; page++) {
        const data = (await fetchJson(
          `https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(token)}/postings?limit=100&offset=${offset}`,
        )) as { totalFound?: number; content?: SrPosting[] };
        if (!data || !Array.isArray(data.content)) return { ok: false, error: "unexpected shape" };
        all.push(...data.content);
        offset += data.content.length;
        if (data.content.length < 100 || offset >= (data.totalFound ?? 0)) break;
      }
      if (all.length === 0) return { ok: false, error: "no postings (unknown company id?)" };
      const india = all.filter((p) => (p.location?.country ?? "").toLowerCase() === "in" || p.location?.remote);
      const posts: RawPost[] = [];
      for (const p of india) {
        let description = "";
        try {
          const d = (await fetchJson(p.ref)) as { jobAd?: { sections?: Record<string, { title?: string; text?: string }> } };
          description = Object.values(d.jobAd?.sections ?? {})
            .map((s) => `${s.title ?? ""}\n${(s.text ?? "").replace(/<[^>]+>/g, " ")}`)
            .join("\n");
        } catch {
          /* keep going without description */
        }
        posts.push({
          externalId: p.id,
          title: p.name?.trim() ?? "",
          company: p.company?.name ?? token,
          locationRaw: [p.location?.city, p.location?.region, p.location?.country?.toUpperCase(), p.location?.remote ? "(Remote)" : ""]
            .filter(Boolean)
            .join(", "),
          country: p.location?.country?.toUpperCase(),
          employmentType: [p.typeOfEmployment?.label, p.experienceLevel?.label].filter(Boolean).join(" / "),
          description: description.replace(/[ \t]+/g, " ").trim(),
          applyUrl: `https://jobs.smartrecruiters.com/${token}/${p.id}`,
          postedAt: p.releasedDate ? new Date(p.releasedDate) : undefined,
          raw: p,
        });
      }
      return { ok: true, company: all[0]?.company?.name ?? token, posts };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  },
};
