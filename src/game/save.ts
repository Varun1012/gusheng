import type { Life, Report } from "@/game/types";

const SNAP = "gusheng.snap.v1";
const BOARD = "gusheng.board.v1";

export interface RunRecord {
  name: string;
  ticker: string;
  countryId: string;
  birthYear: number;
  age: number;
  score: number;
  grade: string;
  capUsd: number;
  capMult: number;
  priceMult: number;
  cause: string;
  at: number;
}

export interface Snap {
  phase: "birth" | "play" | "dead";
  life: Life;
  reports: Report[];
}

export function loadSnap(): Snap | null {
  try {
    const raw = localStorage.getItem(SNAP);
    if (!raw) return null;
    const snap = JSON.parse(raw) as Snap;
    if (!snap?.life?.ticker || !snap.phase) return null;
    const life = snap.life;
    life.purse ??= 0;
    life.salary ??= 0;
    life.slot ??= 0;
    if (life.plan && life.plan.committed == null) life.plan.committed = false;
    return snap;
  } catch {
    return null;
  }
}

export function saveSnap(snap: Snap | null) {
  if (!snap) localStorage.removeItem(SNAP);
  else localStorage.setItem(SNAP, JSON.stringify(snap));
}

export function loadBoard(): RunRecord[] {
  try {
    const raw = localStorage.getItem(BOARD);
    if (!raw) return [];
    const rows = JSON.parse(raw) as RunRecord[];
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

export function pushRecord(record: RunRecord): RunRecord[] {
  const next = [...loadBoard().filter((row) => row.at !== record.at), record]
    .sort((a, b) => b.score - a.score)
    .slice(0, 12);
  localStorage.setItem(BOARD, JSON.stringify(next));
  return next;
}
