import type { RawPost } from "@/lib/sources/types";

/**
 * Cheap pre-filter. Design: the LLM is cheap (Haiku), so the regex gate's job is
 * to (1) veto obviously senior roles and (2) record the signals it saw, so the
 * admin can audit what was skipped. Everything else that is in India goes to the LLM.
 */
const FRESHER_TITLE_RE =
  /\b(intern|interns|internship|fresher|freshers|graduate|new grad|trainee|entry[- ]level|campus|junior|apprentice|early[- ]career|sde[- ]?[1i]\b|engineer[- ]?[1i]\b|level 1)\b/i;
const SENIOR_TITLE_RE =
  /\b(senior|sr\.?|staff|principal|lead|manager|head|director|vp|svp|evp|vice president|architect|chief|cxo|ceo|cto|cfo|coo|ii\b|iii\b|iv\b|executive director|general manager|partner)\b/i;
const FRESHER_DESC_RE =
  /\b([01]\s*(-|–|to)\s*\d{1,2}\s*\+?\s*(years?|yrs?)|0\s*\+?\s*(years?|yrs?)|fresh(er|ers|ly graduated)|no (prior )?(work )?experience|recent graduates?|final[- ]year|pre[- ]final|batch of 20\d\d|class of 20\d\d|20\d\d (grads?|graduates?|batch|pass[- ]?outs?)|campus (hire|hiring|recruit)|graduate (program|programme|trainee)|entry[- ]level|internship|stipend)\b/i;
const SENIOR_DESC_RE = /\b([3-9]|1\d)\s*\+?\s*(years?|yrs?)\s+(of\s+)?(relevant\s+|professional\s+|industry\s+|hands[- ]on\s+)?(experience|exp)\b/i;

export interface RegexVerdict {
  candidate: boolean;
  signals: string[];
}

export function regexGate(p: RawPost): RegexVerdict {
  const signals: string[] = [];
  const et = (p.employmentType ?? "").toLowerCase();
  if (/intern/.test(et)) signals.push("employmentType:intern");
  const tm = FRESHER_TITLE_RE.exec(p.title);
  if (tm) signals.push(`title:${tm[1].toLowerCase()}`);
  const dm = FRESHER_DESC_RE.exec(p.description);
  if (dm) signals.push(`desc:${dm[0].toLowerCase().slice(0, 30)}`);
  const sm = SENIOR_TITLE_RE.exec(p.title);
  if (sm) signals.push(`title-senior:${sm[1].toLowerCase()}`);
  const sd = SENIOR_DESC_RE.exec(p.description);
  if (sd) signals.push(`desc-senior:${sd[0].toLowerCase().slice(0, 30)}`);

  const explicitFresher = signals.includes("employmentType:intern") || !!tm || !!dm;
  const explicitSenior = !!sm || !!sd;
  // Veto only when there is a senior marker and no fresher evidence at all.
  const candidate = explicitFresher || !explicitSenior;
  return { candidate, signals };
}
