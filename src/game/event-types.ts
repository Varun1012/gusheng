import type { Exposure, Flags, Life, RegimeId, Stage } from "@/game/types";

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
  when?: (life: Life) => boolean;
}
