import type { Exposure, Flags, Life, RegimeId, Stage } from "@/game/types";

export type Facet = "mind" | "body" | "kin" | "social" | "money" | "work";

export interface ChoiceDef {
  label: string;
  detail: string;
  exposure: Exposure;
  /** Positive bet. Regime scalar can flip the sign. */
  price: number;
  shares?: number;
  health?: number;
  human?: number;
  reputation?: number;
  leverage?: number;
  /** Mood. Linked to body, family and social life. */
  mind?: number;
  /** Family bond. */
  kin?: number;
  /** Belonging outside the family. */
  social?: number;
  /** Personal cash spent, in USD, converted to local. A shortfall strains kin and mind. */
  spendUsd?: number;
  /** If set, the choice does not happen at all unless the purse covers the full cost. */
  needFull?: boolean;
  /** Subject id when this choice is a university pick. */
  major?: string;
  /** Occupation id. */
  career?: string;
  /** Own wage per year, USD. Not the chair package. */
  jobUsd?: number;
  /** Buy or sell a home with personal funds. */
  house?: "cash" | "mortgage" | "sell";
  /** Cash received into personal funds, in USD. */
  gainUsd?: number;
  /** Sets yearly side income (child work, part-time), in USD. 0 quits it. */
  sideUsd?: number;
  /** Run for office. Success takes the seat. A funded loss gives it up. */
  seekOffice?: boolean;
  hazard?: number;
  cause?: string;
  relist?: string | "safer" | "richer";
  setFlags?: Partial<Flags>;
  bustChance?: number;
  bustPct?: number;
}

export interface GameEvent {
  id: string;
  title: string;
  body: string;
  choices: ChoiceDef[];
  stages?: Stage[];
  anchorAge?: number;
  regimes?: RegimeId[];
  countries?: string[];
  minAge?: number;
  maxAge?: number;
  weight?: number;
  /** Life thread this question pulls on. */
  facet?: Facet;
  /** Can return in a later year. Otherwise once per life. */
  repeat?: boolean;
  /** Years before a repeatable question can return. */
  cooldown?: number;
  /** Pauses the year. Everyday frictions stay off this list. */
  major?: boolean;
  when?: (life: Life) => boolean;
}
