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
  /** Cells 1–10 that may stop for a major choice. At most two. Empty is a quiet year. */
  choiceSlots?: number[];
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
  /** Personal cash in local currency. Born at 0. Spendable at any age. */
  purse: number;
  /** Formal chair package in local currency. Paid into the purse only if they bought the chair. */
  salary: number;
  /** Their own occupation wage, local currency. Not the stock's pay. */
  job?: number;
  /** Subject studied, if any. */
  major?: string;
  /** Occupation they hold. */
  career?: string;
  /** True after they buy back stock and take the chair. */
  chairman?: boolean;
  /** Side income in local currency: child work, part-time, gigs. Any age. */
  side: number;
  /** Kind of work the purse was last spent on. */
  work?: string;
  /** Hobby focused for hobbyYear. One a year. */
  hobby?: string;
  /** Calendar year of the focused hobby. */
  hobbyYear?: number;
  /** Owned home value in local currency. 0 if renting. */
  homeValue?: number;
  /** Mortgage still owed, local currency. */
  homeDebt?: number;
  /** Year of the last house trade. */
  houseYear?: number;
  /** Plain line for the latest spend or policy shift. No formula. */
  statusNote?: string;
  /** Age:cell that already spent. One purse action per cell. */
  spentKey?: string;
  /** Policy whose status nudge is currently applied. */
  policyBias?: PolicyId;
  /** Mood. */
  mind: number;
  /** Family bond. */
  kin: number;
  /** Social belonging. */
  social: number;
  /** Year a repeatable question last appeared. */
  cool: Record<string, number>;
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
