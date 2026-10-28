import { TIER_ORDER, countryById, pickCountryByBirth } from "@/game/countries";
import { eventById, EVENTS } from "@/game/events";
import { capUsd, priceUsd } from "@/game/format";
import { mortalityQx, naturalCause } from "@/game/mortality";
import { familyLine, personName, reticker, tickerOf } from "@/game/names";
import { POLICY_VOL, policyById, policyFits } from "@/game/policies";
import {
  describeMove,
  policyNudge,
  policyShiftLine,
  invertDelta,
  resolveDelta,
  spendById,
  spendCellKey,
} from "@/game/spends";
import { REGIME_DRIFT, REGIME_SCALAR, regimeFor } from "@/game/regimes";
import type { ChoiceDef } from "@/game/event-types";
import type { BirthInput, Exposure, Life, PolicyId, RegimeId, Report, Stage, TierId, YearPlan } from "@/game/types";

const TIER_STATS: Record<
  TierId,
  { cap: [number, number]; px: [number, number]; health: number; human: number; rep: number; policy: PolicyId }
> = {
  destitute: { cap: [18000, 70000], px: [1.2, 4], health: 64, human: 30, rep: 22, policy: "cash" },
  poor: { cap: [70000, 220000], px: [3, 9], health: 70, human: 40, rep: 32, policy: "cash" },
  modest: { cap: [220000, 700000], px: [7, 16], health: 76, human: 50, rep: 42, policy: "human" },
  middle: { cap: [700000, 2500000], px: [14, 32], health: 80, human: 60, rep: 54, policy: "human" },
  affluent: { cap: [2500000, 10000000], px: [28, 60], health: 84, human: 70, rep: 66, policy: "diversify" },
  dynasty: { cap: [10000000, 42000000], px: [48, 110], health: 86, human: 76, rep: 80, policy: "venture" },
};

export function stageOf(age: number): Stage {
  if (age < 6) return "infant";
  if (age < 13) return "child";
  if (age < 18) return "teen";
  if (age < 28) return "youth";
  if (age < 45) return "prime";
  if (age < 60) return "mid";
  if (age < 75) return "late";
  return "elder";
}

function mulberry(state: number): { value: number; state: number } {
  let a = state | 0;
  a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return { value: ((t ^ (t >>> 14)) >>> 0) / 4294967296, state: a };
}

function draw(life: Life): number {
  const next = mulberry(life.rng);
  life.rng = next.state;
  return next.value;
}

function gauss(life: Life): number {
  const u = Math.max(draw(life), 1e-9);
  const v = draw(life);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function logUniform(life: Life, a: number, b: number): number {
  const lo = Math.log(a);
  const hi = Math.log(b);
  return Math.exp(lo + (hi - lo) * draw(life));
}

function clamp(n: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, n));
}

function copy(life: Life): Life {
  return {
    ...life,
    flags: { ...life.flags },
    used: [...life.used],
    history: [...life.history],
    log: [...life.log],
    origin: { ...life.origin },
    plan: life.plan
      ? {
          ...life.plan,
          recent: life.plan.recent ? [...life.plan.recent] : undefined,
          choiceSlots: life.plan.choiceSlots ? [...life.plan.choiceSlots] : undefined,
        }
      : null,
    cool: { ...(life.cool ?? {}) },
  };
}

function fill(template: string, life: Life, regimeName: string, headline: string): string {
  const c = countryById(life.countryId);
  const year = life.birthYear + life.age;
  return template
    .replaceAll("{year}", String(year))
    .replaceAll("{age}", String(life.age))
    .replaceAll("{country}", c.name)
    .replaceAll("{exchange}", c.exchange)
    .replaceAll("{regime}", regimeName)
    .replaceAll("{headline}", headline)
    .replaceAll("{name}", life.name)
    .replaceAll("{ccy}", c.ccy);
}

function eligible(event: (typeof EVENTS)[number], life: Life, regimeId: RegimeId): boolean {
  if (!event.repeat && life.used.includes(event.id)) return false;
  if (event.anchorAge !== undefined && event.anchorAge !== life.age) return false;
  if (event.repeat) {
    const last = life.cool?.[event.id];
    const gap = event.cooldown ?? 5;
    if (last !== undefined && life.birthYear + life.age - last < gap) return false;
  }
  if (event.countries && !event.countries.includes(life.countryId)) return false;
  if (event.minAge !== undefined && life.age < event.minAge) return false;
  if (event.maxAge !== undefined && life.age > event.maxAge) return false;
  if (event.stages && !event.stages.includes(stageOf(life.age))) return false;
  if (event.regimes && !event.regimes.includes(regimeId)) return false;
  if (event.when && !event.when(life)) return false;
  return true;
}

export function previewMortality(life: Life): number {
  return mortalityQx(life.countryId, life.age, life.birthYear + life.age, life.health, life.policy);
}

export function createLife(input: BirthInput = {}): Life {
  const seed = input.seed ?? Math.floor(Math.random() * 1_000_000_000) + 1;
  const life: Life = {
    seed,
    rng: seed,
    origin: { seed, countryId: input.countryId, birthYear: input.birthYear },
    name: "",
    ticker: "",
    countryId: input.countryId ?? "hk",
    birthYear: input.birthYear ?? 1980,
    age: 0,
    alive: true,
    price: 1,
    shares: 1,
    ipoPrice: 1,
    ipoCap: 1,
    ipoPriceUsd: 1,
    ipoCapUsd: 1,
    ipoShares: 1,
    peakCapUsd: 1,
    peakPriceUsd: 1,
    health: 70,
    human: 40,
    reputation: 40,
    leverage: 0.1,
    purse: 0,
    salary: 0,
    side: 0,
    mind: 50,
    kin: 50,
    social: 50,
    cool: {},
    slot: 0,
    policy: "diversify",
    tier: "middle",
    family: "",
    flags: { degree: false, married: false, children: false, home: false, founder: false, civil: false },
    used: [],
    history: [],
    log: [],
    plan: null,
  };

  if (!input.countryId) {
    life.countryId = pickCountryByBirth(() => draw(life));
  }
  if (!input.birthYear) {
    life.birthYear = 1930 + Math.floor(draw(life) * 75);
  }

  const country = countryById(life.countryId);
  const weights = country.weights;
  const total = weights.reduce((s, n) => s + n, 0);
  let r = draw(life) * total;
  let tier: TierId = TIER_ORDER[TIER_ORDER.length - 1]!;
  for (let i = 0; i < TIER_ORDER.length; i += 1) {
    r -= weights[i] ?? 0;
    if (r <= 0) {
      tier = TIER_ORDER[i]!;
      break;
    }
  }
  life.tier = tier;
  const stats = TIER_STATS[tier];
  const capUsd0 = logUniform(life, stats.cap[0], stats.cap[1]);
  const priceUsd0 = logUniform(life, stats.px[0], stats.px[1]);
  life.shares = capUsd0 / priceUsd0;
  life.price = priceUsd0 * country.fx;
  life.ipoPrice = life.price;
  life.ipoCap = life.price * life.shares;
  life.ipoPriceUsd = priceUsd0;
  life.ipoCapUsd = capUsd0;
  life.ipoShares = life.shares;
  life.peakCapUsd = capUsd0;
  life.peakPriceUsd = priceUsd0;
  life.health = clamp(stats.health + (draw(life) - 0.5) * 12, 20, 96);
  life.human = clamp(stats.human + (draw(life) - 0.5) * 12, 8, 96);
  life.reputation = clamp(stats.rep + (draw(life) - 0.5) * 12, 8, 96);
  const mood = {
    destitute: { mind: 44, kin: 46, social: 30 },
    poor: { mind: 48, kin: 52, social: 36 },
    modest: { mind: 52, kin: 58, social: 44 },
    middle: { mind: 55, kin: 60, social: 50 },
    affluent: { mind: 58, kin: 66, social: 60 },
    dynasty: { mind: 60, kin: 74, social: 68 },
  }[tier];
  life.mind = clamp(mood.mind + (draw(life) - 0.5) * 16, 12, 92);
  life.kin = clamp(mood.kin + (draw(life) - 0.5) * 14, 12, 92);
  life.social = clamp(mood.social + (draw(life) - 0.5) * 14, 8, 92);
  life.side = 0;
  life.cool = {};
  life.leverage = clamp(0.04 + draw(life) * 0.08, 0, 0.3);
  life.policy = stats.policy;
  life.name = personName(life.countryId, () => draw(life));
  life.ticker = tickerOf(life.countryId, life.name, () => draw(life));
  life.family = familyLine(life.countryId, tier, () => draw(life));
  const year = life.birthYear;
  life.history.push({
    age: 0,
    year,
    price: life.price,
    cap: life.ipoCap,
    capUsd: capUsd0,
    priceUsd: priceUsd0,
  });
  life.log.push({
    age: 0,
    year,
    title: "敲鐘",
    detail: `${life.name} 於${country.exchange}掛牌，開盤市值 ${Math.round(capUsd0).toLocaleString("zh-HK")} 美元。`,
  });
  return life;
}

/** 0, 1, or 2 cells this year. Which cells is random, not a fixed grid. */
function rollChoiceSlots(life: Life): number[] {
  const roll = draw(life);
  const count = roll < 0.22 ? 0 : roll < 0.7 ? 1 : 2;
  const bag = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const slots: number[] = [];
  for (let i = 0; i < count; i += 1) {
    const index = Math.floor(draw(life) * bag.length);
    const slot = bag.splice(index, 1)[0];
    if (slot !== undefined) slots.push(slot);
  }
  slots.sort((a, b) => a - b);
  return slots;
}

function tunedWeight(event: (typeof EVENTS)[number], life: Life): number {
  let weight = event.weight ?? 1;
  if (event.anchorAge === life.age) weight *= 4;
  if (!event.facet) weight *= 2.4;
  const facet = event.facet;
  if (facet === "mind") weight *= life.mind < 45 ? 2.4 : life.mind > 75 ? 0.75 : 1;
  if (facet === "body") weight *= life.health < 50 ? 2.3 : 1;
  if (facet === "kin") weight *= life.kin < 48 ? 2.2 : 1.1;
  if (facet === "social") weight *= life.social < 45 ? 2.2 : 1.05;
  if (facet === "money") weight *= 1.2;
  if (facet === "work" && life.age < 18) weight *= 1.8;
  if (facet === "work" && life.age >= 16 && life.age < 28) weight *= 1.25;
  return weight;
}

function pickSlotEvent(life: Life): string | null {
  const plan = life.plan;
  if (!plan?.choiceSlots) return null;
  const nextSlot = (life.slot ?? 0) + 1;
  if (!plan.choiceSlots.includes(nextSlot)) return null;
  const pool = EVENTS.filter((event) => event.major && eligible(event, life, plan.regimeId));
  if (pool.length === 0) return null;
  const anchors = pool.filter((event) => event.anchorAge === life.age);
  const use = anchors.length > 0 ? anchors : pool;
  const weights = use.map((event) => ({ event, weight: tunedWeight(event, life) }));
  const total = weights.reduce((sum, item) => sum + item.weight, 0);
  let roll = draw(life) * total;
  for (const item of weights) {
    roll -= item.weight;
    if (roll <= 0) return item.event.id;
  }
  return weights[weights.length - 1]!.event.id;
}

export function beginYear(life: Life): Life {
  if (!life.alive) return life;
  const next = copy(life);
  if (next.plan && next.plan.slotMode === "cell" && next.plan.age === next.age) return next;
  const year = next.birthYear + next.age;
  const regime = regimeFor(year, next.countryId);
  const payNote = reviewPay(next);
  next.slot = 0;
  next.plan = {
    age: next.age,
    year,
    regimeId: regime.id,
    regimeName: regime.name,
    headline: regime.headline,
    eventId: null,
    q: mortalityQx(next.countryId, next.age, year, next.health, next.policy),
    committed: true,
    slotMode: "cell",
    pendingSlot: null,
    yearOpenUsd: priceUsd(next),
    yearOpenCapUsd: capUsd(next),
    payNote,
    anchorDone: false,
    hadChoice: false,
    choiceSlots: rollChoiceSlots(next),
    recent: [],
    explanation: "",
  };
  return next;
}

function resolveRelist(life: Life, relist: string): string | null {
  if (relist === "safer") {
    const order = ["hk", "jp", "sg", "kr", "tw", "de", "gb"];
    const target = order.find((id) => id !== life.countryId) ?? "hk";
    return target === life.countryId ? null : target;
  }
  if (relist === "richer") {
    const target = life.countryId === "us" ? "sg" : "us";
    return target;
  }
  return relist === life.countryId ? null : relist;
}

function applyRelist(life: Life, targetId: string) {
  const from = countryById(life.countryId);
  const to = countryById(targetId);
  const usd = (life.price * life.shares) / from.fx;
  const purseUsd = (life.purse ?? 0) / from.fx;
  const sideUsd = (life.side ?? 0) / from.fx;
  life.countryId = targetId;
  life.price = (usd / life.shares) * to.fx;
  life.purse = purseUsd * to.fx;
  life.side = sideUsd * to.fx;
  life.ticker = reticker(life.ticker, targetId);
}

const TIER_PAY: Record<TierId, number> = {
  destitute: 3500,
  poor: 7000,
  modest: 12000,
  middle: 20000,
  affluent: 32000,
  dynasty: 48000,
};

/** What the board would pay this year, in local currency. Internal. */
export function offerSalary(life: Life): number {
  const country = countryById(life.countryId);
  const multiple = Math.max(0.25, priceUsd(life) / Math.max(life.ipoPriceUsd, 0.01));
  const skill = life.human / 100;
  const name = life.reputation / 100;
  const body = life.health / 100;
  const mood = (life.mind ?? 50) / 100;
  const bond = (life.social ?? 50) / 100;
  const usd =
    TIER_PAY[life.tier] *
    (0.4 + skill * 0.75 + name * 0.25 + body * 0.12 + mood * 0.16 + bond * 0.1) *
    clamp(0.7 + Math.log2(multiple) * 0.18, 0.45, 2.4);
  return Math.max(0, usd * country.fx);
}

function reviewPay(life: Life): string | undefined {
  if (life.age < 18) {
    life.salary = 0;
    return undefined;
  }
  const prev = life.salary;
  const next = offerSalary(life);
  if (prev <= 0) {
    life.salary = next;
    return "董事局按表現通過第一份薪酬";
  }
  life.salary = prev * 0.7 + next * 0.3;
  const change = (life.salary - prev) / prev;
  if (Math.abs(change) < 0.12) return undefined;
  return change > 0 ? "董事局上調薪酬" : "董事局削減薪酬";
}

const CELL_QUIET = ["沒有頭條的一格", "報價自己往前走", "這格只剩呼吸和租金", "市場沒有叫你的名字", "帳本翻過一頁"];

const TAPES: { title: string; line: string; price: number }[] = [
  { title: "順風的頭條", line: "這格的新聞站在你這邊。", price: 0.016 },
  { title: "逆風的頭條", line: "這格的新聞踩了你一腳。", price: -0.016 },
  { title: "睡了一個整覺", line: "身體把這一格撐住了。", price: 0.006 },
  { title: "發燒的幾天", line: "沒有停牌，報價只是軟了一點。", price: -0.008 },
  { title: "親戚開口", line: "人情先過帳，股價跟著晃。", price: -0.01 },
  { title: "意外的紅利", line: "不是董事局的薪酬，是這格自己掉下來的。", price: 0.014 },
  { title: "房租調了", line: "生活成本先走一步。", price: -0.009 },
  { title: "舊同學來訊", line: "名聲輕輕動了一下。", price: 0.005 },
  { title: "加班到很晚", line: "這一格賣給了工作。", price: 0.008 },
  { title: "放自己一天", line: "報價幾乎沒動，人回來了。", price: 0.002 },
  { title: "路口的小意外", line: "人沒事，心情有事。", price: -0.007 },
  { title: "街坊的好事", line: "你被算進好運的那一邊。", price: 0.01 },
  { title: "政策口風", line: "市場先交易傳聞。", price: 0.012 },
  { title: "謠言過境", line: "沒有實錘，價格還是縮了。", price: -0.012 },
];

function remember(life: Life, line: string) {
  const plan = life.plan;
  if (!plan) return;
  plan.note = line;
  plan.recent = [...(plan.recent ?? []), line].slice(-4);
}

function pushPrint(life: Life) {
  const usdCap = capUsd(life);
  const usdPx = priceUsd(life);
  if (usdCap > life.peakCapUsd) life.peakCapUsd = usdCap;
  if (usdPx > life.peakPriceUsd) life.peakPriceUsd = usdPx;
  life.history.push({
    age: life.age,
    year: life.birthYear + life.age,
    slot: life.slot,
    price: life.price,
    cap: life.price * life.shares,
    capUsd: usdCap,
    priceUsd: usdPx,
  });
}

function accrueSlot(life: Life) {
  const parentCover = life.age < 18 && life.salary <= 0 && life.side <= 0;
  if (parentCover) return;
  const inflow = (life.salary + life.side) / 10;
  const living = life.age < 18 ? life.side * 0.035 : life.salary * 0.064 + life.side * 0.04;
  life.purse = Math.max(0, life.purse + inflow - living);
  if (life.age >= 18 && life.salary <= 0 && life.side <= 0 && life.purse > 0) {
    const fx = countryById(life.countryId).fx;
    life.purse = Math.max(0, life.purse - (80 * fx) / 10);
  }
}

function lifeScore(life: Life): number {
  return (life.mind + life.health + life.kin + life.social + life.human + life.reputation) / 6;
}

function policyFit(life: Life): number {
  const plan = life.plan;
  if (!plan) return 0;
  return REGIME_SCALAR[plan.regimeId][policyById(life.policy).exposure];
}

/** Ambient drift of the person. Same number of draws every call so the clock stays deterministic. */
function tickStats(life: Life) {
  const plan = life.plan!;
  const regime = plan.regimeId;
  const policy = life.policy;
  const warm = regime === "expansion" || regime === "bubble" || regime === "recovery";
  const cold = regime === "crisis" || regime === "recession" || regime === "tightening";
  const ageDrag = life.age > 58 ? (life.age - 58) * 0.18 : 0;

  let healthTarget = (policy === "health" ? 78 : 62) - ageDrag - (regime === "crisis" ? 5 : regime === "stagflation" ? 2 : 0);
  if (life.mind < 40) healthTarget -= (40 - life.mind) * 0.2;
  if (life.kin > 70) healthTarget += 3;
  healthTarget = clamp(healthTarget, 28, 88);

  let mindTarget = 58;
  if (life.health < 50) mindTarget -= (50 - life.health) * 0.28;
  if (life.kin < 45) mindTarget -= (45 - life.kin) * 0.16;
  if (life.social < 40) mindTarget -= (40 - life.social) * 0.12;
  if (cold) mindTarget -= 5;
  if (policy === "cash" || policy === "health") mindTarget += 5;
  if (!warm && (policy === "leverage" || policy === "venture")) mindTarget -= 4;
  mindTarget = clamp(mindTarget, 22, 86);

  const humanTarget = clamp(
    (policy === "human" ? 78 : 56) + (life.age < 18 ? -6 : life.age > 64 ? -4 : 2) - (cold ? 3 : 0),
    22,
    88,
  );

  let kinTarget = policy === "health" || policy === "cash" ? 66 : 56;
  if (life.mind < 35) kinTarget -= 5;
  if (regime === "crisis") kinTarget -= 3;
  kinTarget = clamp(kinTarget, 26, 84);

  let socialTarget = policy === "diversify" || policy === "human" ? 64 : 52;
  if (life.kin < 35) socialTarget -= 4;
  if (cold) socialTarget -= 3;
  if (warm && (policy === "venture" || policy === "leverage")) socialTarget += 3;
  socialTarget = clamp(socialTarget, 22, 82);

  let repTarget = 52;
  if (warm && (policy === "leverage" || policy === "venture")) repTarget = 68;
  if ((regime === "crisis" || regime === "tightening") && policy === "cash") repTarget = 66;
  if (life.social < 30) repTarget -= 6;
  if (!policyFits(regime, policy)) repTarget -= 4;
  repTarget = clamp(repTarget, 20, 84);

  const pull = 0.075;
  const jitter = () => (draw(life) - 0.5) * 2.4;
  life.health = clamp(life.health + (healthTarget - life.health) * pull + jitter(), 0, 100);
  life.mind = clamp(life.mind + (mindTarget - life.mind) * pull + jitter(), 0, 100);
  life.human = clamp(life.human + (humanTarget - life.human) * pull + jitter() * 0.65, 0, 100);
  life.kin = clamp(life.kin + (kinTarget - life.kin) * pull + jitter(), 0, 100);
  life.social = clamp(life.social + (socialTarget - life.social) * pull + jitter(), 0, 100);
  life.reputation = clamp(life.reputation + (repTarget - life.reputation) * pull + jitter() * 0.55, 0, 100);
}

function statusRevalue(before: number, after: number): number {
  return clamp((after - before) * 0.012, -0.03, 0.03);
}

function slotDrift(life: Life): number {
  const plan = life.plan!;
  const country = countryById(life.countryId);
  const fit = policyFit(life);
  const appropriate = fit >= 0.85;
  const prod = ageProductivity(life.age);
  const body = life.health < 25 ? 0.72 : 0.86 + (life.health / 100) * 0.18;
  const mood = life.mind < 28 ? 0.8 : 0.9 + (life.mind / 100) * 0.12;
  let drift: number;
  if (appropriate) {
    const base = REGIME_DRIFT[plan.regimeId] / 10;
    if (base >= 0) {
      drift = base * fit * prod * body * mood * country.growth;
    } else {
      drift = base * 0.45 * Math.min(fit, 1.4);
      drift += (fit - 0.85) * 0.0045 * prod * body;
    }
  } else {
    drift = -(0.85 - Math.min(fit, 0.85)) * 0.008;
    if (fit < 0) drift -= -fit * 0.012;
  }
  drift += (gauss(life) * 0.012 * POLICY_VOL[life.policy] * country.vol) / Math.sqrt(10);
  if (life.leverage > 0.72 && drift < 0 && (plan.regimeId === "crisis" || plan.regimeId === "tightening")) {
    drift -= (0.04 + life.leverage * 0.05) / 10;
  }
  if (!appropriate) drift = Math.min(0, drift);
  return drift;
}

function movePrice(life: Life, pricePct: number, sharePct: number) {
  const country = countryById(life.countryId);
  life.price = Math.max(0.02 * country.fx, life.price * (1 + pricePct));
  life.shares = Math.max(1, life.shares * (1 + sharePct));
}

function naturalHit(life: Life): boolean {
  const plan = life.plan!;
  const qSlot = 1 - Math.pow(1 - Math.min(plan.q, 0.999), 0.1);
  const roll = draw(life);
  plan.roll = roll;
  if (roll >= qSlot) return false;
  plan.cause = naturalCause(life.age, life.countryId, plan.year, draw(life));
  return true;
}

function makeReport(life: Life, died: boolean): Report {
  const plan = life.plan!;
  const openUsd = plan.yearOpenUsd ?? priceUsd(life);
  const openCap = plan.yearOpenCapUsd ?? capUsd(life);
  const nowUsd = priceUsd(life);
  const nowCap = capUsd(life);
  return {
    age: plan.age,
    year: plan.year,
    title: plan.title ?? plan.note ?? plan.headline,
    detail: plan.detail ?? plan.note ?? "",
    explanation: plan.explanation ?? "",
    regimeName: plan.regimeName,
    headline: plan.headline,
    pricePct: openUsd > 0 ? nowUsd / openUsd - 1 : 0,
    capPct: openCap > 0 ? nowCap / openCap - 1 : 0,
    sharePct: plan.sharePct ?? 0,
    q: plan.q,
    roll: plan.roll ?? 0,
    died,
    relistedTo: plan.relistedTo,
    cause: plan.cause,
    payNote: plan.payNote,
  };
}

function kill(life: Life, cause: string): Report {
  const plan = life.plan!;
  plan.cause = cause;
  plan.died = true;
  const report = makeReport(life, true);
  life.alive = false;
  life.cause = cause;
  life.deathYear = plan.year;
  life.log.push({
    age: life.age,
    year: plan.year,
    title: cause,
    detail: "這一格沒有走完。",
  });
  life.plan = null;
  return report;
}

function playQuietSlot(life: Life) {
  const plan = life.plan!;
  const before = lifeScore(life);
  tickStats(life);
  const revalue = statusRevalue(before, lifeScore(life));
  const appropriate = policyFit(life) >= 0.85;
  let drift = slotDrift(life);
  let title = CELL_QUIET[Math.floor(draw(life) * CELL_QUIET.length)]!;
  let shown = title;
  if (draw(life) < 0.55) {
    const tape = TAPES[Math.floor(draw(life) * TAPES.length)]!;
    if (appropriate || tape.price <= 0) {
      drift += tape.price;
      title = tape.title;
      shown = tape.line;
    }
  }
  if (appropriate) drift += revalue;
  else drift += Math.min(0, revalue);
  if (!appropriate) drift = Math.min(0, drift);
  drift = clamp(drift, -0.09, appropriate ? 0.08 : 0);
  movePrice(life, drift, 0);
  life.slot = (life.slot ?? 0) + 1;
  accrueSlot(life);
  plan.eventId = null;
  plan.committed = true;
  plan.pendingSlot = null;
  if (!plan.hadChoice) plan.title = title;
  remember(life, shown);
  pushPrint(life);
}

function applyChoice(life: Life, index: number): Report | null {
  const plan = life.plan;
  if (!plan || plan.age !== life.age) throw new Error("year is not planned");
  const event = plan.eventId ? eventById(plan.eventId) : undefined;
  if (!event || index < 0 || index >= event.choices.length) throw new Error("choice required");
  const choice = event.choices[index]!;
  const priceBefore = life.price;
  const scoreBefore = lifeScore(life);
  const scalar = REGIME_SCALAR[plan.regimeId][choice.exposure];
  let pricePct = choice.price * scalar;
  const aligned = policyById(life.policy).exposure === choice.exposure;
  const risky: Exposure[] = ["leverage", "venture", "real"];
  const hedged = (life.policy === "cash" || life.policy === "diversify") && pricePct < 0 && risky.includes(choice.exposure);
  if (aligned) pricePct *= pricePct >= 0 ? 1.22 : 1.16;
  if (hedged) pricePct *= 0.62;
  if (life.policy === "leverage" && risky.includes(choice.exposure) && choice.exposure !== "leverage") {
    pricePct *= 1.1;
  }
  if (choice.exposure === "human" || choice.exposure === "career") {
    pricePct *= 0.72 + (life.human / 100) * 0.5;
  }
  pricePct += ((life.reputation - 50) / 50) * 0.012;
  pricePct += (draw(life) - 0.5) * 0.035;
  let bust = false;
  let margin = false;
  if (choice.bustChance && draw(life) < choice.bustChance) {
    pricePct = Math.min(pricePct, choice.bustPct ?? -0.4);
    bust = true;
  }
  if (life.leverage > 0.72 && pricePct < 0 && (plan.regimeId === "crisis" || plan.regimeId === "tightening")) {
    pricePct -= 0.05 + life.leverage * 0.08;
    margin = true;
  }
  const sharePct = choice.shares ?? 0;
  life.health = clamp(life.health + (choice.health ?? 0), 0, 100);
  life.human = clamp(life.human + (choice.human ?? 0), 0, 100);
  life.reputation = clamp(life.reputation + (choice.reputation ?? 0), 0, 100);
  life.mind = clamp(life.mind + (choice.mind ?? 0), 0, 100);
  life.kin = clamp(life.kin + (choice.kin ?? 0), 0, 100);
  life.social = clamp(life.social + (choice.social ?? 0), 0, 100);
  life.leverage = clamp(life.leverage + (choice.leverage ?? 0), 0, 0.94);
  if (choice.setFlags) life.flags = { ...life.flags, ...choice.setFlags };
  tickStats(life);
  const revalue = statusRevalue(scoreBefore, lifeScore(life));
  const fit = policyFit(life);
  const appropriate = fit >= 0.85;
  if (!appropriate) {
    pricePct = Math.min(0, pricePct) - Math.max(0, 0.85 - fit) * 0.03 + Math.min(0, revalue);
  } else {
    pricePct = pricePct * (0.65 + Math.min(fit, 1.8) * 0.4) + revalue;
  }
  pricePct = clamp(pricePct, -0.72, appropriate ? 0.95 : 0);
  movePrice(life, pricePct, sharePct);
  const economic = life.price / priceBefore - 1;
  const bits = [
    appropriate
      ? `基本政策合這段「${plan.regimeName}」，這一步可以改寫股價，結果 ${signed(economic)}`
      : `基本政策不合這段「${plan.regimeName}」，股價沒有被推上去，結果 ${signed(economic)}`,
  ];
  if (bust) bits.push("對手方倒了，這筆變成虧損");
  if (margin) bits.push("槓桿觸發追繳");
  if (sharePct > 0.02) bits.push("流通股增發，每股被攤薄");
  if (sharePct < -0.02) bits.push("公司回購了一部分");
  plan.explanation = `${plan.explanation ?? ""}${bits.join("。")}。`;
  plan.sharePct = sharePct;
  plan.title = event.title;
  plan.detail = choice.label;
  plan.hadChoice = true;
  if (event.repeat) life.cool = { ...(life.cool ?? {}), [event.id]: plan.year };
  else if (!life.used.includes(event.id)) life.used.push(event.id);
  if (choice.relist) {
    const target = resolveRelist(life, choice.relist);
    if (target) {
      const fromName = countryById(life.countryId).name;
      applyRelist(life, target);
      plan.relistedTo = target;
      plan.explanation += `已從${fromName}轉板至${countryById(target).name}。美元股價連續，之後的死亡率改按當地計算。`;
    }
  }
  if (choice.sideUsd !== undefined) {
    life.side = Math.max(0, choice.sideUsd * countryById(life.countryId).fx);
  }
  life.slot = plan.pendingSlot ?? (life.slot ?? 0) + 1;
  accrueSlot(life);
  const fx = countryById(life.countryId).fx;
  if (choice.gainUsd) life.purse += choice.gainUsd * fx;
  if (choice.spendUsd && choice.spendUsd > 0) {
    const cost = choice.spendUsd * fx;
    if (life.purse >= cost) life.purse -= cost;
    else {
      life.purse = 0;
      life.kin = clamp(life.kin - 4, 0, 100);
      life.mind = clamp(life.mind - 3, 0, 100);
    }
  }
  plan.eventId = null;
  plan.committed = true;
  plan.pendingSlot = null;
  remember(life, choice.label);
  pushPrint(life);
  life.log.push({
    age: life.age,
    year: plan.year,
    title: event.title,
    detail: choice.label,
  });
  const hazard = choice.hazard ?? 0;
  if (hazard > 0 && choice.cause && draw(life) < hazard) return kill(life, choice.cause);
  if (naturalHit(life)) return kill(life, plan.cause ?? "病故");
  return null;
}

function ageAYear(life: Life) {
  const target = life.policy === "cash" ? 0.06 : life.policy === "leverage" ? 0.58 : life.policy === "venture" ? 0.34 : 0.16;
  life.leverage = clamp(life.leverage + (target - life.leverage) * 0.18, 0, 0.94);
  life.side = Math.max(0, life.side * 0.9);
}

function closeYear(life: Life): Report {
  const plan = life.plan!;
  ageAYear(life);
  life.price = Math.max(0.02 * countryById(life.countryId).fx, life.price);
  const report = makeReport(life, false);
  life.log.push({
    age: life.age,
    year: plan.year,
    title: plan.title ?? "本年收市",
    detail: plan.headline,
  });
  if (plan.payNote) {
    life.log.push({
      age: life.age,
      year: plan.year,
      title: plan.payNote,
      detail: `年薪 ${Math.round(life.salary).toLocaleString("zh-HK")} ${countryById(life.countryId).ccy}。`,
    });
  }
  life.age += 1;
  life.slot = 0;
  life.plan = null;
  return report;
}

/** Lock the waiting cell. A fatal choice returns the delisting report. */
export function acceptChoice(source: Life, index: number): { life: Life; report: Report | null } {
  const life = copy(source);
  if (!life.alive) return { life, report: null };
  if (!life.plan || life.plan.slotMode !== "cell" || life.plan.age !== life.age) {
    return { life: beginYear(life), report: null };
  }
  if (life.plan.committed || !life.plan.eventId) return { life, report: null };
  const report = applyChoice(life, index);
  return { life, report };
}

/** One cell. One call per second while the market is open. */
export function advance(source: Life): { life: Life; report: Report | null } {
  if (!source.alive) return { life: source, report: null };
  let life = copy(source);
  if (!life.plan || life.plan.slotMode !== "cell" || life.plan.age !== life.age) life = beginYear(life);
  const plan = life.plan;
  if (!plan) return { life, report: null };
  if (!plan.choiceSlots) plan.choiceSlots = rollChoiceSlots(life);
  if (plan.eventId && !plan.committed) return { life: source, report: null };
  if ((life.slot ?? 0) >= 10) {
    const report = closeYear(life);
    return { life: beginYear(life), report };
  }
  if (life.age >= 112) return { life, report: kill(life, "超高齡") };
  const eventId = pickSlotEvent(life);
  if (eventId) {
    plan.eventId = eventId;
    plan.committed = false;
    plan.pendingSlot = (life.slot ?? 0) + 1;
    return { life, report: null };
  }
  playQuietSlot(life);
  if (naturalHit(life)) return { life, report: kill(life, plan.cause ?? "病故") };
  return { life, report: null };
}

export function choose(source: Life, index: number | null): { life: Life; report: Report | null } {
  let life = copy(source);
  if (!life.alive) return { life, report: null };
  if (!life.plan || life.plan.slotMode !== "cell" || life.plan.age !== life.age) life = beginYear(life);
  if (life.plan?.eventId && !life.plan.committed) {
    if (index === null) throw new Error("choice required");
    const report = applyChoice(life, index);
    if (report) return { life, report };
  }
  for (let i = 0; i < 16; i += 1) {
    const step = advance(life);
    if (step.report) return step;
    const waiting = step.life.plan?.eventId && !step.life.plan.committed;
    if (waiting || step.life === life) return { life: step.life, report: null };
    life = step.life;
  }
  throw new Error("year did not close");
}

function signed(x: number): string {
  const p = x * 100;
  return `${p > 0 ? "+" : ""}${p.toFixed(1)}%`;
}

function pct(x: number): string {
  if (x < 0.01) return `${(x * 100).toFixed(2)}%`;
  return `${(x * 100).toFixed(1)}%`;
}

function ageProductivity(age: number): number {
  if (age < 18) return 0.28;
  if (age < 26) return 0.72;
  if (age < 45) return 1.12;
  if (age < 58) return 0.95;
  if (age < 68) return 0.62;
  return 0.32;
}

function applyDelta(
  life: Life,
  delta: { mind: number; health: number; kin: number; social: number; human: number; reputation: number },
) {
  life.mind = clamp(life.mind + delta.mind, 0, 100);
  life.health = clamp(life.health + delta.health, 0, 100);
  life.kin = clamp(life.kin + delta.kin, 0, 100);
  life.social = clamp(life.social + delta.social, 0, 100);
  life.human = clamp(life.human + delta.human, 0, 100);
  life.reputation = clamp(life.reputation + delta.reputation, 0, 100);
}

function snapStats(life: Life) {
  return {
    mind: life.mind,
    health: life.health,
    kin: life.kin,
    social: life.social,
    human: life.human,
    reputation: life.reputation,
  };
}

export function setPolicy(life: Life, policy: PolicyId): Life {
  if (life.policy === policy) return life;
  const next = copy(life);
  if (next.policyBias) applyDelta(next, invertDelta(policyNudge(next.policyBias)));
  applyDelta(next, policyNudge(policy));
  next.policyBias = policy;
  next.policy = policy;
  const line = policyShiftLine(policy);
  next.statusNote = line;
  if (next.plan) remember(next, line);
  return next;
}

/** Spend purse on a hobby or a kind of work. One action per cell. Does not advance the clock. */
export function spend(source: Life, id: string): Life {
  const item = spendById(id);
  if (!item || !source.alive || !source.plan) return source;
  if (source.age < item.minAge) return source;
  if (item.maxAge !== undefined && source.age > item.maxAge) return source;
  const key = spendCellKey(source);
  if ((source.spentKey ?? "") === key) return source;
  const fx = countryById(source.countryId).fx;
  const cost = item.usd * fx;
  const short = (source.purse ?? 0) < cost;
  if (short && !item.stake) return source;

  const life = copy(source);
  const before = snapStats(life);
  const beforeScore = lifeScore(life);
  const delta = resolveDelta(life.policy, item);
  if (short) {
    life.purse = 0;
    delta.kin -= 4;
    delta.mind -= 3;
  } else {
    life.purse = Math.max(0, life.purse - cost);
  }
  applyDelta(life, delta);
  const revalue = statusRevalue(beforeScore, lifeScore(life));
  const appropriate = policyFit(life) >= 0.85;
  let drift = appropriate ? revalue : Math.min(0, revalue);
  drift = clamp(drift, -0.06, appropriate ? 0.04 : 0);
  if (drift !== 0) movePrice(life, drift, 0);
  if (item.ease) life.side = Math.max(0, life.side * 0.45);
  else if (item.sideUsd !== undefined) life.side = Math.max(0, item.sideUsd * fx);
  if (item.work) life.work = item.work;
  life.spentKey = key;
  const tail = item.ease ? "工作放輕了" : item.work ? "這份工作換上了" : undefined;
  const note = describeMove(item.label, before, snapStats(life), short, tail);
  life.statusNote = note;
  remember(life, note);
  life.log.push({
    age: life.age,
    year: life.plan?.year ?? life.birthYear + life.age,
    title: "個人花錢",
    detail: note,
  });
  return life;
}

export function fastForward(source: Life): { life: Life; reports: Report[] } {
  const reports: Report[] = [];
  let life = source;
  for (let i = 0; i < 5; i += 1) {
    if (!life.alive) break;
    if (life.plan?.eventId && !life.plan.committed) break;
    const step = choose(life, null);
    life = step.life;
    if (step.report) reports.push(step.report);
    if (!life.alive || (life.plan?.eventId && !life.plan.committed) || !step.report) break;
  }
  return { life, reports };
}

export function currentChoices(life: Life): ChoiceDef[] {
  if (!life.plan?.eventId || life.plan.committed) return [];
  return eventById(life.plan.eventId)?.choices ?? [];
}

export function currentEventCopy(life: Life): { title: string; body: string; facet: string | null } | null {
  if (!life.plan?.eventId || life.plan.committed) return null;
  const event = eventById(life.plan.eventId);
  if (!event || !life.plan) return null;
  return {
    title: fill(event.title, life, life.plan.regimeName, life.plan.headline),
    body: fill(event.body, life, life.plan.regimeName, life.plan.headline),
    facet: event.facet ?? null,
  };
}

export function runBalance(n: number): {
  medianAge: number;
  p10: number;
  p90: number;
  infantDeaths: number;
  medianMult: number;
  p90Mult: number;
} {
  const ages: number[] = [];
  const mults: number[] = [];
  let infantDeaths = 0;
  for (let i = 0; i < n; i += 1) {
    let life = beginYear(createLife({ seed: 10_000 + i * 97 }));
    let guard = 0;
    while (life.alive && guard < 2500) {
      guard += 1;
      if (!life.plan || life.plan.slotMode !== "cell" || life.plan.age !== life.age) life = beginYear(life);
      const choices = currentChoices(life);
      const index = choices.length ? Math.floor(draw(life) * choices.length) : null;
      const step = choose(life, index);
      life = step.life;
      if (!life.alive) break;
    }
    if (!life.alive && life.age < 1) infantDeaths += 1;
    ages.push(life.age);
    mults.push((priceUsd(life) * life.shares) / life.ipoCapUsd);
  }
  ages.sort((a, b) => a - b);
  mults.sort((a, b) => a - b);
  const q = (arr: number[], p: number) => arr[Math.min(arr.length - 1, Math.floor(p * (arr.length - 1)))] ?? 0;
  return {
    medianAge: q(ages, 0.5),
    p10: q(ages, 0.1),
    p90: q(ages, 0.9),
    infantDeaths,
    medianMult: q(mults, 0.5),
    p90Mult: q(mults, 0.9),
  };
}
