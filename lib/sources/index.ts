import type { SourceKind } from "@/lib/db/schema";
import type { SourceAdapter } from "./types";
import { greenhouse } from "./greenhouse";
import { lever } from "./lever";
import { ashby } from "./ashby";
import { smartrecruiters } from "./smartrecruiters";

export const adapters: Record<SourceKind, SourceAdapter> = { greenhouse, lever, ashby, smartrecruiters };
export type { RawPost, FetchResult, FetchError, SourceAdapter } from "./types";
