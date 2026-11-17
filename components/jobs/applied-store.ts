"use client";

import { useSyncExternalStore } from "react";

/** localStorage-backed "did I apply?" tracker. No accounts: one map for the demo student (Ved Mohan). */
export const APPLIED_KEY = "beep.applied";
export type AppliedState = "clicked" | "yes" | "no";
export type AppliedMap = Readonly<Record<string, AppliedState>>;

const EMPTY: AppliedMap = Object.freeze({});
const VALID: readonly string[] = ["clicked", "yes", "no"];
const listeners = new Set<() => void>();
let cache: { raw: string | null; map: AppliedMap } = { raw: null, map: EMPTY };

function sanitize(input: unknown): AppliedMap {
  if (!input || typeof input !== "object") return EMPTY;
  const out: Record<string, AppliedState> = {};
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (typeof v === "string" && VALID.includes(v)) out[k] = v as AppliedState;
  }
  return out;
}

function read(): AppliedMap {
  try {
    const raw = window.localStorage.getItem(APPLIED_KEY);
    if (raw === cache.raw) return cache.map; // stable reference for useSyncExternalStore
    cache = { raw, map: raw ? sanitize(JSON.parse(raw)) : EMPTY };
    return cache.map;
  } catch {
    return cache.map;
  }
}

function notify() {
  for (const l of listeners) l();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === APPLIED_KEY) cb();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

export function setApplied(jobId: number, state: AppliedState) {
  const next = { ...read(), [String(jobId)]: state };
  try {
    window.localStorage.setItem(APPLIED_KEY, JSON.stringify(next));
  } catch {
    // storage unavailable (private mode / quota): keep the in-memory copy so the UI still responds
    cache = { raw: cache.raw, map: next };
  }
  notify();
}

export function useAppliedMap(): AppliedMap {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

export function useAppliedState(jobId: number): AppliedState | undefined {
  return useAppliedMap()[String(jobId)];
}
