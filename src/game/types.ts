export type PolicyId = "cash" | "leverage" | "human" | "health" | "diversify" | "venture";

export type RegimeId =
  | "expansion"
  | "bubble"
  | "recession"
  | "crisis"
  | "stagflation"
  | "recovery"
  | "tightening"
  | "deflation";

export type Exposure =
  | "leverage"
  | "cash"
  | "human"
  | "health"
  | "diversify"
  | "venture"
  | "real"
  | "career";

export type TierId = "destitute" | "poor" | "modest" | "middle" | "affluent" | "dynasty";

export type Stage = "infant" | "child" | "teen" | "youth" | "prime" | "mid" | "late" | "elder";

export interface Flags {
  degree: boolean;
  married: boolean;
  children: boolean;
  home: boolean;
  founder: boolean;
  civil: boolean;
}

export interface HistPoint {
  age: number;
  year: number;
  price: number;
  cap: number;
  capUsd: number;
  /** Dollar price at the print. Missing on older saves; derived from cap. */
  priceUsd?: number;
  /** 1–10 within that year of age. Missing on year-end saves and the IPO print. */
  slot?: number;
}

export interface LogLine {
  age: number;
  year: number;
  title: string;
  detail: string;
}

export interface YearPlan {
  age: number;
  year: number;
  regimeId: RegimeId;
  regimeName: string;
  headline: string;
  eventId: string | null;
  q: number;
  /** False only while a choice is waiting on the current cell. */
  committed: boolean;
  /** "cell" prices and events are per slot. Older saves omit this. */
  slotMode?: "cell";
  /** Cell about to print while a choice is open, 1–10. */
  pendingSlot?: number | null;
  yearOpenUsd?: number;
  yearOpenCapUsd?: number;
  /** Latest cell headline. Not a formula. */
  note?: string;
  /** Short ticker of this year's cells. */
  recent?: string[];
  anchorDone?: boolean;
  hadChoice?: boolean;
  priceFrom?: number;
  priceTo?: number;
  sharesFrom?: number;
  sharesTo?: number;
  purseFrom?: number;
  purseTo?: number;
  title?: string;
  detail?: string;
  explanation?: string;
  sharePct?: number;
  pricePct?: number;
  capPct?: number;
  died?: boolean;
  cause?: string;
  roll?: number;
  relistedTo?: string;
  payNote?: string;
}

export interface BirthInput {
  seed?: number;
  countryId?: string;
  birthYear?: number;
}

export interface Life {
  seed: number;
  rng: number;
  origin: BirthInput;
  name: string;
  ticker: string;
  countryId: string;
  birthYear: number;
  age: number;
  alive: boolean;
  price: number;
  shares: number;
  ipoPrice: number;
  ipoCap: number;
  ipoPriceUsd: number;
  ipoCapUsd: number;
  ipoShares: number;
  peakCapUsd: number;
  peakPriceUsd: number;
  health: number;
  human: number;
  reputation: number;
  leverage: number;
  /** Personal cash in local currency. Born at 0. */
  purse: number;
  /** Annual pay in local currency. 0 until the board sets it at 18. */
  salary: number;
  /** Tenth of the current year already played, 0–10. */
  slot: number;
  policy: PolicyId;
  tier: TierId;
  family: string;
  flags: Flags;
  used: string[];
  history: HistPoint[];
  log: LogLine[];
  plan: YearPlan | null;
  cause?: string;
  deathYear?: number;
  recorded?: boolean;
}

export interface Report {
  age: number;
  year: number;
  title: string;
  detail: string;
  explanation: string;
  regimeName: string;
  headline: string;
  pricePct: number;
  capPct: number;
  sharePct: number;
  q: number;
  roll: number;
  died: boolean;
  relistedTo?: string;
  cause?: string;
  /** Outcome only: the board set or changed pay. No formula. */
  payNote?: string;
}
