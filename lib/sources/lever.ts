import { fetchJson, type SourceAdapter } from "./types";

interface LeverPost {
  id: string;
  text: string;
  country?: string;
  workplaceType?: string;
  createdAt?: number;
  categories?: { commitment?: string; location?: string; team?: string; department?: string; allLocations?: string[] };
  descriptionPlain?: string;
  openingPlain?: string;
  additionalPlain?: string;
  lists?: { text: string; content: string }[];
  hostedUrl: string;
  applyUrl: string;
}

export const lever: SourceAdapter = {
  kind: "lever",
  boardUrl: (t) => `https://jobs.lever.co/${t}`,
  async fetchBoard(token) {
    try {
      const data = await fetchJson(`https://api.lever.co/v0/postings/${encodeURIComponent(token)}?mode=json`);
      if (!Array.isArray(data)) {
        const err = (data as { error?: string })?.error;
        return { ok: false, error: err ? `lever: ${err}` : "unexpected shape (not an array)" };
      }
      const posts = (data as LeverPost[]).map((p) => {
        const lists = (p.lists ?? [])
          .map((l) => `${l.text}\n${l.content.replace(/<[^>]+>/g, " ")}`)
          .join("\n");
        const loc = [p.categories?.location, ...(p.categories?.allLocations ?? [])]
          .filter(Boolean)
          .filter((v, i, a) => a.indexOf(v) === i)
          .join(", ");
        return {
          externalId: p.id,
          title: p.text?.trim() ?? "",
          company: token,
          locationRaw: [loc, p.workplaceType && p.workplaceType !== "unspecified" ? `(${p.workplaceType})` : ""]
            .filter(Boolean)
            .join(" "),
          country: p.country,
          employmentType: p.categories?.commitment,
          description: [p.openingPlain, p.descriptionPlain, lists, p.additionalPlain].filter(Boolean).join("\n").trim(),
          applyUrl: p.hostedUrl ?? p.applyUrl,
          postedAt: p.createdAt ? new Date(p.createdAt) : undefined,
          raw: { ...p, descriptionPlain: undefined, description: undefined, lists: undefined, additional: undefined, opening: undefined },
        };
      });
      return { ok: true, company: token, posts };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  },
};
