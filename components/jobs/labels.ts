import type { City, JobType, Role, SourceKind } from "@/lib/db/schema";

// Human labels for the enum-ish string columns. Type-only schema import keeps this module client-safe.
export const CITY_LABELS: Record<City, string> = {
  bengaluru: "Bengaluru",
  mumbai: "Mumbai",
  pune: "Pune",
  hyderabad: "Hyderabad",
  chennai: "Chennai",
  delhi_ncr: "Delhi NCR",
  kolkata: "Kolkata",
  ahmedabad: "Ahmedabad",
  remote: "Remote",
  multiple: "Multiple cities",
  other_india: "Other (India)",
};

export const ROLE_LABELS: Record<Role, string> = {
  software_engineering: "Software Engineering",
  data_ml: "Data / ML",
  product: "Product",
  design: "Design",
  marketing: "Marketing",
  sales_bd: "Sales / BD",
  operations: "Operations",
  finance: "Finance",
  hr: "HR",
  content: "Content",
  customer_support: "Customer Support",
  research: "Research",
  other: "Other",
};

export const JOB_TYPE_LABELS: Record<JobType, string> = {
  internship: "Internship",
  full_time: "Full time",
  unknown: "Type unspecified",
};

export const KIND_LABELS: Record<SourceKind, string> = {
  greenhouse: "Greenhouse",
  lever: "Lever",
  ashby: "Ashby",
  smartrecruiters: "SmartRecruiters",
};

/** Public board URL per ATS; mirrors `boardUrl` in lib/sources/*.ts. */
export function boardUrl(kind: SourceKind, token: string): string {
  const t = encodeURIComponent(token);
  switch (kind) {
    case "greenhouse":
      return `https://job-boards.greenhouse.io/${t}`;
    case "lever":
      return `https://jobs.lever.co/${t}`;
    case "ashby":
      return `https://jobs.ashbyhq.com/${t}`;
    case "smartrecruiters":
      return `https://jobs.smartrecruiters.com/${t}`;
  }
}

const DAY_MS = 86_400_000;

/** "today" / "3 days ago" / "2 months ago". `now` is passed in so server output is deterministic per request. */
export function formatPostedAgo(date: Date | null, now: Date): string {
  if (!date) return "date unknown";
  const days = Math.floor((now.getTime() - date.getTime()) / DAY_MS);
  if (days <= 0) return "today";
  if (days === 1) return "1 day ago";
  if (days < 60) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return `${months} months ago`;
}

export function formatRefreshedAgo(date: Date | null, now: Date): string {
  if (!date) return "not yet";
  const hours = Math.floor((now.getTime() - date.getTime()) / 3_600_000);
  if (hours < 1) return "less than an hour ago";
  if (hours === 1) return "1 hour ago";
  if (hours < 48) return `${hours} hours ago`;
  return `${Math.floor(hours / 24)} days ago`;
}

export function formatDate(date: Date | null): string {
  if (!date) return "Unknown date";
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
}

export function companyInitial(company: string): string {
  const ch = company.trim().charAt(0);
  return ch ? ch.toUpperCase() : "?";
}
