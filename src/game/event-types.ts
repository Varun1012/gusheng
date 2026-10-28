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
  /** Cash received into personal funds, in USD. */
  gainUsd?: number;
  /** Sets yearly side income (child work, part-time), in USD. 0 quits it. */
  sideUsd?: number;
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
