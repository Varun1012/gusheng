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
}
