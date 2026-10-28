import type { PolicyId } from "@/game/types";

export type StatKey = "mind" | "health" | "kin" | "social" | "human" | "reputation";
export type StatDelta = Record<StatKey, number>;

export type SpendId =
  | "read"
  | "sport"
  | "music"
  | "meal"
  | "walk"
  | "park"
  | "gig"
  | "craft"
  | "night"
  | "stall"
  | "ease"
  | "deposit"
  | "index"
  | "stake"
  | "lend";

export type InvestLean = "calm" | "skill" | "nerve" | "bond";

export interface SpendDef {
  id: SpendId;
  group: "hobby" | "work" | "invest";
  label: string;
  minAge: number;
  maxAge?: number;
  /** Cost in USD, charged in local currency. Shown as an amount, not a formula. */
  usd: number;
  /** Entry work can be fronted by the family when the purse is short. */
  stake?: boolean;
  /** Replaces side income, USD per year. */
  sideUsd?: number;
  /** Lighten whatever work is already there. */
  ease?: boolean;
  work?: string;
  /** If set, the stake can come back or be lost. Chance follows status bars. */
  invest?: { lean: InvestLean; win: number; lose: number };
  base: StatDelta;
}

function bars(
  mind: number,
  health: number,
  kin: number,
  social: number,
  human: number,
  reputation: number,
): StatDelta {
  return { mind, health, kin, social, human, reputation };
}

export const SPENDS: SpendDef[] = [
  { id: "walk", group: "hobby", label: "走路", minAge: 4, usd: 0, base: bars(2, 3, 0, 1, 0, 0) },
  { id: "park", group: "hobby", label: "去公園", minAge: 4, usd: 0, base: bars(2, 2, 0, 3, 0, 0) },
  { id: "sport", group: "hobby", label: "去運動", minAge: 5, usd: 0, base: bars(2, 5, 0, 1, 0, 0) },
  { id: "music", group: "hobby", label: "學樂器", minAge: 6, usd: 48, base: bars(4, 0, 0, 2, 2, 0) },
  { id: "read", group: "hobby", label: "買書", minAge: 6, usd: 22, base: bars(4, 0, 0, 1, 3, 0) },
  { id: "meal", group: "hobby", label: "請家人吃飯", minAge: 6, usd: 36, base: bars(2, 1, 5, 0, 0, 0) },
  {
    id: "gig",
    group: "work",
    label: "去打零工",
    minAge: 7,
    maxAge: 72,
    usd: 10,
    stake: true,
    sideUsd: 1200,
    work: "gig",
    base: bars(-1, -3, 0, 1, 2, 1),
  },
  {
    id: "craft",
    group: "work",
    label: "學一門手藝",
    minAge: 12,
    usd: 80,
    sideUsd: 1700,
    work: "craft",
    base: bars(2, -1, 0, 0, 5, 1),
  },
  {
    id: "night",
    group: "work",
    label: "上夜班",
    minAge: 16,
    maxAge: 66,
    usd: 16,
    sideUsd: 2600,
    work: "night",
    base: bars(-3, -5, 0, 1, 1, 2),
  },
  {
    id: "stall",
    group: "work",
    label: "自己擺攤",
    minAge: 15,
    usd: 130,
    sideUsd: 2100,
    work: "stall",
    base: bars(-2, -2, 0, 2, 2, 3),
  },
  {
    id: "ease",
    group: "work",
    label: "把工作放輕",
    minAge: 8,
    usd: 40,
    ease: true,
    work: "light",
    base: bars(3, 4, 1, 0, -1, 0),
  },
  {
    id: "deposit",
    group: "invest",
    label: "放一筆定存",
    minAge: 15,
    usd: 500,
    invest: { lean: "calm", win: 1.08, lose: 0.04 },
    base: bars(1, 0, 1, 0, 0, 0),
  },
  {
    id: "index",
    group: "invest",
    label: "買海外公司",
    minAge: 16,
    usd: 800,
    invest: { lean: "skill", win: 1.5, lose: 0.75 },
    base: bars(-1, 0, 0, 0, 1, 0),
  },
  {
    id: "stake",
    group: "invest",
    label: "買本地公司",
    minAge: 18,
    usd: 1000,
    invest: { lean: "nerve", win: 1.9, lose: 1 },
    base: bars(-1, 0, 0, 0, 1, 1),
  },
  {
    id: "lend",
    group: "invest",
    label: "借給熟人",
    minAge: 16,
    usd: 300,
    invest: { lean: "bond", win: 1.3, lose: 1 },
    base: bars(0, 0, 1, 1, 0, 0),
  },
];

export function spendById(id: string): SpendDef | undefined {
  return SPENDS.find((item) => item.id === id);
}

export function spendCellKey(life: {
  age: number;
  slot?: number;
  plan?: { eventId?: string | null; committed?: boolean; pendingSlot?: number | null } | null;
}): string {
  const waiting = Boolean(life.plan?.eventId && !life.plan.committed);
  const cell = waiting && life.plan?.pendingSlot ? life.plan.pendingSlot : (life.slot ?? 0);
  return `${life.age}:${cell}`;
}

export function spendVisible(item: SpendDef, age: number): boolean {
  if (age < item.minAge) return false;
  if (item.maxAge !== undefined && age > item.maxAge) return false;
  return true;
}

export function hobbyYearOf(life: {
  birthYear: number;
  age: number;
  plan?: { year?: number } | null;
}): number {
  return life.plan?.year ?? life.birthYear + life.age;
}

export function spendOpen(
  item: SpendDef,
  life: {
    age: number;
    birthYear: number;
    purse?: number;
    spentKey?: string;
    hobby?: string;
    hobbyYear?: number;
    slot?: number;
    plan?: { year?: number; eventId?: string | null; committed?: boolean; pendingSlot?: number | null } | null;
  },
  fx: number,
): boolean {
  if (!spendVisible(item, life.age)) return false;
  const year = hobbyYearOf(life);
  const focused = Boolean(life.hobby) && life.hobbyYear === year;
  if (item.group === "hobby" && focused && life.hobby === item.id) return true;
  if (item.group === "hobby" && focused && life.hobby !== item.id) return false;
  if (item.group !== "hobby" && (life.spentKey ?? "") === spendCellKey(life)) return false;
  return true;
}

export function investChance(
  stats: { mind: number; health: number; human: number; kin: number; social: number; reputation: number },
  lean: InvestLean,
): number {
  const avg =
    lean === "calm"
      ? (stats.mind + stats.kin) / 2
      : lean === "skill"
        ? (stats.mind + stats.human + stats.health) / 3
        : lean === "nerve"
          ? (stats.mind + stats.human + stats.reputation) / 3
          : (stats.kin + stats.social + stats.mind) / 3;
  return Math.min(0.9, Math.max(0.15, 0.18 + (avg / 100) * 0.72));
}

export function policyMood(id: PolicyId): string {
  switch (id) {
    case "cash":
      return "現金堡壘把狀態往安穩帶：心理和家庭比較厚，把錢押進工作時心情更容易緊。";
    case "leverage":
      return "槓桿進取把狀態往前衝帶：名氣容易起來，心理和健康更容易被抽走。";
    case "human":
      return "人力複利把狀態往本事帶：讀書和手藝抬得較高，硬熬的班比較磨人。";
    case "health":
      return "健康優先把狀態往身體帶：休息和運動回得較多，熬夜的損傷會輕一點。";
    case "diversify":
      return "全球分散把狀態往關係帶：出門見人比較厚，家和社會不容易一下子散。";
    case "venture":
      return "創業集中把狀態往事業帶：押在自己的工作上，名氣和本事一起動，身心比較緊。";
  }
}

export function policyShiftLine(id: PolicyId): string {
  switch (id) {
    case "cash":
      return "換成現金堡壘。心理和家庭往安穩偏。";
    case "leverage":
      return "換成槓桿進取。名氣往前，身心被抽緊。";
    case "human":
      return "換成人力複利。本事和心情往上偏。";
    case "health":
      return "換成健康優先。身體和心情鬆了一點。";
    case "diversify":
      return "換成全球分散。社會和家裡厚了一點。";
    case "venture":
      return "換成創業集中。名氣起來，身心緊了。";
  }
}

export function invertDelta(delta: StatDelta): StatDelta {
  return {
    mind: -delta.mind,
    health: -delta.health,
    kin: -delta.kin,
    social: -delta.social,
    human: -delta.human,
    reputation: -delta.reputation,
  };
}

export function policyNudge(id: PolicyId): StatDelta {
  switch (id) {
    case "cash":
      return bars(3, 0, 3, 0, 0, 0);
    case "leverage":
      return bars(-3, -2, 0, 0, 0, 3);
    case "human":
      return bars(2, 0, 0, 0, 3, 0);
    case "health":
      return bars(2, 3, 0, 0, 0, 0);
    case "diversify":
      return bars(0, 0, 1, 3, 0, 0);
    case "venture":
      return bars(-2, -2, 0, 0, 2, 3);
  }
}

function grind(id: SpendId): boolean {
  return id === "gig" || id === "night";
}

export function resolveDelta(policy: PolicyId, spend: SpendDef): StatDelta {
  const delta = { ...spend.base };
  const extra = bars(0, 0, 0, 0, 0, 0);
  const study = spend.id === "read" || spend.id === "craft";
  const body = spend.id === "sport" || spend.id === "walk" || spend.id === "ease";
  const home = spend.id === "meal" || spend.id === "ease";
  const people = spend.id === "park" || spend.id === "music" || spend.id === "walk";
  const ventureWork = spend.id === "stall" || spend.id === "craft";

  if (policy === "health") {
    if (body) {
      extra.health += 3;
      extra.mind += 1;
    }
    if (grind(spend.id)) {
      extra.health += 2;
      extra.mind += 1;
    }
    if (spend.group === "hobby" && !body) extra.health += 1;
  }
  if (policy === "human") {
    if (study) {
      extra.human += 3;
      extra.mind += 2;
    }
    if (grind(spend.id)) {
      extra.human += 1;
      extra.mind -= 1;
    }
    if (people) extra.social += 1;
  }
  if (policy === "cash") {
    if (home) {
      extra.kin += 2;
      extra.mind += 2;
    }
    if (grind(spend.id) || ventureWork) {
      extra.mind -= 2;
      extra.kin -= 1;
    }
    if (spend.group === "hobby" && !home) extra.mind += 1;
  }
  if (policy === "diversify") {
    if (people) {
      extra.social += 3;
      extra.mind += 1;
    }
    if (home) {
      extra.kin += 1;
      extra.social += 1;
    }
    if (grind(spend.id)) extra.social += 1;
  }
  if (policy === "leverage") {
    if (grind(spend.id) || ventureWork) {
      extra.reputation += 3;
      extra.health -= 2;
      extra.mind -= 2;
    }
    if (body) {
      extra.health -= 1;
      extra.reputation += 1;
    }
    if (home) extra.kin -= 1;
  }
  if (policy === "venture") {
    if (spend.id === "stall" || spend.id === "craft") {
      extra.reputation += 3;
      extra.human += 2;
      extra.mind -= 2;
      extra.health -= 1;
    }
    if (study && spend.id !== "craft") {
      extra.human += 1;
      extra.reputation += 1;
    }
    if (home) {
      extra.mind -= 1;
      extra.kin -= 1;
    }
    if (grind(spend.id)) {
      extra.reputation += 1;
      extra.health -= 1;
    }
  }

  (Object.keys(delta) as StatKey[]).forEach((key) => {
    delta[key] += extra[key];
  });
  return delta;
}

const UP: Record<StatKey, string> = {
  mind: "心理鬆了一點",
  health: "健康回了一些",
  kin: "家裡近了",
  social: "社會關係厚了",
  human: "本事厚了",
  reputation: "名氣起來了",
};

const DOWN: Record<StatKey, string> = {
  mind: "心理緊了",
  health: "身體被抽走",
  kin: "家裡遠了",
  social: "社會關係薄了",
  human: "本事薄了",
  reputation: "名氣退了",
};

const ORDER: StatKey[] = ["mind", "health", "kin", "social", "human", "reputation"];

export function describeMove(
  label: string,
  before: StatDelta,
  after: StatDelta,
  _shortfall: boolean,
  tail?: string,
): string {
  const bits: string[] = [];
  for (const key of ORDER) {
    const diff = after[key] - before[key];
    if (diff >= 0.5) bits.push(UP[key]);
    else if (diff <= -0.5) bits.push(DOWN[key]);
  }
  const head = `花在${label}`;
  const body = bits.length > 0 ? bits.join("，") : "狀態幾乎沒有再動";
  const end = tail ? `${tail}。` : "";
  return `${head}。${body}。${end}`;
}

export function workLabel(id: string | undefined): string {
  switch (id) {
    case "gig":
      return "零工";
    case "craft":
      return "手藝";
    case "night":
      return "夜班";
    case "stall":
      return "自己的攤";
    case "light":
      return "放輕的工作";
    default:
      return "";
  }
}
