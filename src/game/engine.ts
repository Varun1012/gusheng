import { TIER_ORDER, countryById, pickCountryByBirth } from "@/game/countries";
import { eventById, EVENTS } from "@/game/events";
import { capUsd, priceUsd } from "@/game/format";
import { mortalityQx, naturalCause } from "@/game/mortality";
import { familyLine, personName, reticker, tickerOf } from "@/game/names";
import { EXPOSURE_NAME, POLICY_BETA, POLICY_VOL, policyById } from "@/game/policies";
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

const STAGE_P: Record<Stage, number> = {
  infant: 0.72,
  child: 0.48,
  teen: 0.62,
  youth: 0.74,
  prime: 0.7,
  mid: 0.66,
  late: 0.52,
  elder: 0.48,
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
    plan: life.plan ? { ...life.plan, recent: life.plan.recent ? [...life.plan.recent] : undefined } : null,
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
  if (life.used.includes(event.id)) return false;
  if (event.countries && !event.countries.includes(life.countryId)) return false;
  if (event.minAge !== undefined && life.age < event.minAge) return false;
  if (event.maxAge !== undefined && life.age > event.maxAge) return false;
  if (event.stages && !event.stages.includes(stageOf(life.age))) return false;
  if (event.regimes && !event.regimes.includes(regimeId)) return false;
  if (event.when && !event.when(life)) return false;
  return true;
}

function weighted<T extends { weight?: number }>(items: T[], life: Life): T {
  const total = items.reduce((sum, item) => sum + (item.weight ?? 1), 0);
  let r = draw(life) * total;
  for (const item of items) {
    r -= item.weight ?? 1;
    if (r <= 0) return item;
  }
  return items[items.length - 1]!;
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

function pickSlotEvent(life: Life): string | null {
  const plan = life.plan;
  if (!plan) return null;
  const regimeId = plan.regimeId;
  if (!plan.anchorDone) {
    const anchors = EVENTS.filter((event) => event.anchorAge === life.age && eligible(event, life, regimeId));
    if (anchors.length === 0) {
      plan.anchorDone = true;
    } else if (draw(life) < ((life.slot ?? 0) === 0 ? 0.9 : 0.6)) {
      plan.anchorDone = true;
      return weighted(anchors, life).id;
    }
  }
  const yearly = STAGE_P[stageOf(life.age)];
  const chance = 1 - Math.pow(1 - yearly, 0.1);
  if (draw(life) > chance) return null;
  const pool = EVENTS.filter((event) => event.anchorAge === undefined && eligible(event, life, regimeId));
  if (pool.length === 0) return null;
  return weighted(pool, life).id;
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
  life.countryId = targetId;
  life.price = (usd / life.shares) * to.fx;
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
  const usd =
    TIER_PAY[life.tier] *
    (0.45 + skill * 0.9 + name * 0.35 + body * 0.15) *
    clamp(0.7 + Math.log2(multiple) * 0.18, 0.45, 2.4);
  return Math.max(0, usd * country.fx);
}

function reviewPay(life: Life): string | undefined {
  if (life.age < 18) {
    life.salary = 0;
    life.purse = 0;
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
  if (life.age < 18) {
    life.purse = 0;
    return;
  }
  life.purse = Math.max(0, life.purse + life.salary * 0.036);
}

function slotDrift(life: Life): number {
  const plan = life.plan!;
  const country = countryById(life.countryId);
  let drift = (REGIME_DRIFT[plan.regimeId] * POLICY_BETA[life.policy]) / 10;
  const prod = ageProductivity(life.age);
  const humanF = 0.62 + (life.human / 100) * 0.7;
  const healthF = life.health < 25 ? 0.55 : 0.78 + (life.health / 100) * 0.3;
  drift *= prod * humanF * healthF * country.growth;
  drift *= 1 + life.leverage * (life.policy === "leverage" ? 0.85 : 0.3);
  drift += (gauss(life) * 0.03 * POLICY_VOL[life.policy] * country.vol) / Math.sqrt(10);
  if (life.leverage > 0.72 && drift < 0 && (plan.regimeId === "crisis" || plan.regimeId === "tightening")) {
    drift -= (0.05 + life.leverage * 0.07) / 10;
  }
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
  let drift = slotDrift(life);
  let title = CELL_QUIET[Math.floor(draw(life) * CELL_QUIET.length)]!;
  let shown = title;
  if (draw(life) < 0.55) {
    const tape = TAPES[Math.floor(draw(life) * TAPES.length)]!;
    drift += tape.price;
    title = tape.title;
    shown = tape.line;
  }
  drift = clamp(drift, -0.09, 0.08);
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
  const country = countryById(life.countryId);
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
  pricePct = clamp(pricePct, -0.72, 0.95);
  const sharePct = choice.shares ?? 0;
  life.health = clamp(life.health + (choice.health ?? 0), 0, 100);
  life.human = clamp(life.human + (choice.human ?? 0), 0, 100);
  life.reputation = clamp(life.reputation + (choice.reputation ?? 0), 0, 100);
  life.leverage = clamp(life.leverage + (choice.leverage ?? 0), 0, 0.94);
  if (choice.setFlags) life.flags = { ...life.flags, ...choice.setFlags };
  movePrice(life, pricePct, sharePct);
  const economic = life.price / priceBefore - 1;
  const bits = [`「${plan.regimeName}」對「${EXPOSURE_NAME[choice.exposure]}」的係數是 ${scalar.toFixed(2)}，股價 ${signed(economic)}`];
  if (aligned) bits.push("與你的基本政策同向，波幅被放大");
  if (hedged) bits.push("現金或分散削掉了一部分跌幅");
  if (bust) bits.push("對手方倒了，這筆變成虧損");
  if (margin) bits.push("槓桿觸發追繳");
  if (sharePct > 0.02) bits.push(`流通股增發 ${signed(sharePct)}，每股被攤薄`);
  if (sharePct < -0.02) bits.push(`回購 ${signed(-sharePct)}`);
  plan.explanation = `${plan.explanation ?? ""}${bits.join("。")}。`;
  plan.sharePct = sharePct;
  plan.title = event.title;
  plan.detail = choice.label;
  plan.hadChoice = true;
  life.used.push(event.id);
  if (choice.relist) {
    const target = resolveRelist(life, choice.relist);
    if (target) {
      const fromName = countryById(life.countryId).name;
      applyRelist(life, target);
      plan.relistedTo = target;
      plan.explanation += `已從${fromName}轉板至${countryById(target).name}。美元股價連續，之後的死亡率改按當地計算。`;
    }
  }
  life.slot = plan.pendingSlot ?? (life.slot ?? 0) + 1;
  accrueSlot(life);
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
  const plan = life.plan!;
  life.human = clamp(life.human + (life.policy === "human" ? 1.05 : 0.22) - (life.age > 64 ? 0.35 : 0), 0, 100);
  life.health = clamp(
    life.health +
      (life.policy === "health" ? 0.4 : -0.1) -
      (life.age > 58 ? (life.age - 58) * 0.055 : 0) -
      (plan.regimeId === "crisis" ? 0.35 : 0),
    0,
    100,
  );
  if (!plan.hadChoice) {
    const open = plan.yearOpenUsd ?? priceUsd(life);
    const drift = open > 0 ? priceUsd(life) / open - 1 : 0;
    life.reputation = clamp(life.reputation + (drift > 0.02 ? 0.25 : drift < -0.02 ? -0.25 : 0), 0, 100);
  }
  const target = life.policy === "cash" ? 0.06 : life.policy === "leverage" ? 0.58 : life.policy === "venture" ? 0.34 : 0.16;
  life.leverage = clamp(life.leverage + (target - life.leverage) * 0.18, 0, 0.94);
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

export function setPolicy(life: Life, policy: PolicyId): Life {
  const next = copy(life);
  next.policy = policy;
  return next;
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

export function currentEventCopy(life: Life): { title: string; body: string } | null {
  if (!life.plan?.eventId || life.plan.committed) return null;
  const event = eventById(life.plan.eventId);
  if (!event || !life.plan) return null;
  return {
    title: fill(event.title, life, life.plan.regimeName, life.plan.headline),
    body: fill(event.body, life, life.plan.regimeName, life.plan.headline),
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
