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
    plan: life.plan ? { ...life.plan } : null,
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
  });
  life.log.push({
    age: 0,
    year,
    title: "敲鐘",
    detail: `${life.name} 於${country.exchange}掛牌，開盤市值 ${Math.round(capUsd0).toLocaleString("zh-HK")} 美元。`,
  });
  return life;
}

function pickEvent(life: Life, regimeId: ReturnType<typeof regimeFor>["id"]): string | null {
  const anchors = EVENTS.filter((event) => event.anchorAge === life.age && eligible(event, life, regimeId));
  if (anchors.length > 0 && draw(life) < 0.9) return weighted(anchors, life).id;
  if (draw(life) > STAGE_P[stageOf(life.age)]) return null;
  const pool = EVENTS.filter((event) => event.anchorAge === undefined && eligible(event, life, regimeId));
  if (pool.length === 0) return anchors[0]?.id ?? null;
  return weighted(pool, life).id;
}

export function beginYear(life: Life): Life {
  if (!life.alive) return life;
  const next = copy(life);
  if (next.plan && next.plan.age === next.age) return next;
  const year = next.birthYear + next.age;
  const regime = regimeFor(year, next.countryId);
  const eventId = pickEvent(next, regime.id);
  const plan: YearPlan = {
    age: next.age,
    year,
    regimeId: regime.id,
    regimeName: regime.name,
    headline: regime.headline,
    eventId,
    q: mortalityQx(next.countryId, next.age, year, next.health, next.policy),
    committed: false,
  };
  next.slot = 0;
  next.plan = plan;
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

const QUIET = [
  "沒有頭條的一年",
  "市場把你遺忘了一陣",
  "工資、租金與新聞都按預期發生",
  "你按政策過了一年",
  "帳本比日記更長",
];

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

function yearPurseTarget(life: Life): number {
  if (life.age < 18) return 0;
  const cost = life.salary * 0.64;
  return Math.max(0, life.purse + life.salary - cost);
}

function blend(from: number, to: number, t: number): number {
  if (from <= 0 || to <= 0) return from + (to - from) * t;
  return from * Math.pow(to / from, t);
}

function commit(life: Life, index: number | null) {
  const plan = life.plan;
  if (!plan || plan.age !== life.age) throw new Error("year is not planned");
  const event = plan.eventId ? eventById(plan.eventId) : undefined;
  if (event && (index === null || index < 0 || index >= event.choices.length)) {
    throw new Error("choice required");
  }
  const choice = event && index !== null ? event.choices[index] : undefined;
  const priceBefore = life.price;
  const capBefore = life.price * life.shares;
  const country = countryById(life.countryId);
  let explanation = "";
  let title = "";
  let detail = "";
  let sharePct = 0;
  let bust = false;
  let margin = false;
  let pricePct = 0;

  if (choice && event) {
    const scalar = REGIME_SCALAR[plan.regimeId][choice.exposure];
    pricePct = choice.price * scalar;
    const aligned = policyById(life.policy).exposure === choice.exposure;
    const risky: Exposure[] = ["leverage", "venture", "real"];
    const hedged =
      (life.policy === "cash" || life.policy === "diversify") && pricePct < 0 && risky.includes(choice.exposure);
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
    if (choice.bustChance && draw(life) < choice.bustChance) {
      pricePct = Math.min(pricePct, choice.bustPct ?? -0.4);
      bust = true;
    }
    if (life.leverage > 0.72 && pricePct < 0 && (plan.regimeId === "crisis" || plan.regimeId === "tightening")) {
      pricePct -= 0.05 + life.leverage * 0.08;
      margin = true;
    }
    pricePct = clamp(pricePct, -0.72, 0.95);
    sharePct = choice.shares ?? 0;
    life.health = clamp(life.health + (choice.health ?? 0), 0, 100);
    life.human = clamp(life.human + (choice.human ?? 0), 0, 100);
    life.reputation = clamp(life.reputation + (choice.reputation ?? 0), 0, 100);
    life.leverage = clamp(life.leverage + (choice.leverage ?? 0), 0, 0.94);
    if (choice.setFlags) life.flags = { ...life.flags, ...choice.setFlags };
    title = event.title;
    detail = choice.label;
    const bits = [
      `「${plan.regimeName}」對「${EXPOSURE_NAME[choice.exposure]}」的係數是 ${scalar.toFixed(2)}，股價 ${signed(pricePct)}`,
    ];
    if (aligned) bits.push("與你的基本政策同向，波幅被放大");
    if (hedged) bits.push("現金或分散削掉了一部分跌幅");
    if (bust) bits.push("對手方倒了，這筆變成虧損");
    if (margin) bits.push("槓桿觸發追繳");
    if (sharePct > 0.02) bits.push(`流通股增發 ${signed(sharePct)}，每股被攤薄`);
    if (sharePct < -0.02) bits.push(`回購 ${signed(-sharePct)}`);
    explanation = `${bits.join("。")}。`;
    life.used.push(event.id);
  } else {
    let drift = REGIME_DRIFT[plan.regimeId] * POLICY_BETA[life.policy];
    const prod = ageProductivity(life.age);
    const humanF = 0.62 + (life.human / 100) * 0.7;
    const healthF = life.health < 25 ? 0.55 : 0.78 + (life.health / 100) * 0.3;
    drift *= prod * humanF * healthF * country.growth;
    drift *= 1 + life.leverage * (life.policy === "leverage" ? 0.85 : 0.3);
    drift += gauss(life) * 0.03 * POLICY_VOL[life.policy] * country.vol;
    if (life.leverage > 0.72 && drift < 0 && (plan.regimeId === "crisis" || plan.regimeId === "tightening")) {
      drift -= 0.05 + life.leverage * 0.07;
      margin = true;
    }
    drift = clamp(drift, -0.42, 0.36);
    pricePct = drift;
    life.human = clamp(life.human + (life.policy === "human" ? 1.05 : 0.22) - (life.age > 64 ? 0.35 : 0), 0, 100);
    life.health = clamp(
      life.health +
        (life.policy === "health" ? 0.4 : -0.1) -
        (life.age > 58 ? (life.age - 58) * 0.055 : 0) -
        (plan.regimeId === "crisis" ? 0.35 : 0),
      0,
      100,
    );
    life.reputation = clamp(life.reputation + (drift > 0.02 ? 0.25 : drift < -0.02 ? -0.25 : 0), 0, 100);
    const target =
      life.policy === "cash" ? 0.06 : life.policy === "leverage" ? 0.58 : life.policy === "venture" ? 0.34 : 0.16;
    life.leverage = clamp(life.leverage + (target - life.leverage) * 0.18, 0, 0.94);
    title = QUIET[Math.floor(draw(life) * QUIET.length)]!;
    detail = plan.headline;
    explanation = `沒有抉擇。${plan.regimeName}的漂移，乘上「${policyById(life.policy).name}」與 ${life.age} 歲的生產力，股價 ${signed(drift)}。${margin ? "槓桿在逆風裡被追繳。" : ""}`;
    sharePct = 0;
  }

  const priceTo = Math.max(0.02 * country.fx, priceBefore * (1 + pricePct));
  const sharesTo = Math.max(1, life.shares * (1 + sharePct));
  const economicPricePct = priceTo / priceBefore - 1;
  const economicCapPct = (priceTo * sharesTo) / capBefore - 1;

  plan.priceFrom = priceBefore;
  plan.priceTo = priceTo;
  plan.sharesFrom = life.shares;
  plan.sharesTo = sharesTo;
  plan.pricePct = economicPricePct;
  plan.capPct = economicCapPct;
  plan.sharePct = sharePct;
  plan.title = title;
  plan.detail = detail;
  plan.explanation = explanation;

  let relistedTo: string | undefined;
  if (choice?.relist) {
    life.price = priceTo;
    life.shares = sharesTo;
    const target = resolveRelist(life, choice.relist);
    if (target) {
      const fromName = countryById(life.countryId).name;
      applyRelist(life, target);
      relistedTo = target;
      const toName = countryById(target).name;
      plan.explanation += `已從${fromName}轉板至${toName}。美元市值連續，之後的死亡率改按當地計算。`;
      plan.priceFrom = life.price;
      plan.priceTo = life.price;
      plan.sharesFrom = life.shares;
      plan.sharesTo = life.shares;
    } else {
      life.price = priceBefore;
      life.shares = plan.sharesFrom;
    }
  }
  plan.relistedTo = relistedTo;

  const payNote = reviewPay(life);
  plan.payNote = payNote;
  plan.purseFrom = life.age < 18 ? 0 : life.purse;
  plan.purseTo = yearPurseTarget(life);

  const hazard = choice?.hazard ?? 0;
  const roll = draw(life);
  let died = false;
  let cause: string | undefined;
  if (life.age >= 112) {
    died = true;
    cause = "超高齡";
  } else if (roll < hazard && choice?.cause) {
    died = true;
    cause = choice.cause;
  } else if (hazard < 1 && (roll - hazard) / (1 - hazard) < plan.q) {
    died = true;
    cause = naturalCause(life.age, life.countryId, plan.year, draw(life));
  }
  plan.died = died;
  plan.cause = cause;
  plan.roll = roll;
  plan.committed = true;
}

function paintSlot(life: Life) {
  const plan = life.plan;
  if (!plan?.committed || plan.priceFrom === undefined || plan.priceTo === undefined) return;
  const t = Math.min(1, life.slot / 10);
  life.price = t >= 1 ? plan.priceTo : blend(plan.priceFrom, plan.priceTo, t);
  const sharesFrom = plan.sharesFrom ?? life.shares;
  const sharesTo = plan.sharesTo ?? life.shares;
  life.shares = t >= 1 ? sharesTo : blend(sharesFrom, sharesTo, t);
  const purseFrom = plan.purseFrom ?? 0;
  const purseTo = plan.purseTo ?? purseFrom;
  life.purse = t >= 1 ? purseTo : purseFrom + (purseTo - purseFrom) * t;
}

function closeYear(life: Life): Report {
  const plan = life.plan!;
  life.slot = 10;
  paintSlot(life);
  life.price = plan.priceTo ?? life.price;
  life.shares = plan.sharesTo ?? life.shares;
  life.purse = plan.purseTo ?? life.purse;
  const died = Boolean(plan.died);
  const usdCap = capUsd(life);
  const usdPx = priceUsd(life);
  if (usdCap > life.peakCapUsd) life.peakCapUsd = usdCap;
  if (usdPx > life.peakPriceUsd) life.peakPriceUsd = usdPx;
  life.history.push({
    age: life.age,
    year: plan.year,
    price: life.price,
    cap: life.price * life.shares,
    capUsd: usdCap,
  });
  const roll = plan.roll ?? 0;
  const surviveLine = died
    ? `存活檢定失敗。本年死亡率 ${pct(plan.q)}，擲出 ${pct(roll)}。`
    : `存活。本年死亡率 ${pct(plan.q)}，擲出 ${pct(roll)}。`;
  life.log.push({
    age: life.age,
    year: plan.year,
    title: plan.title ?? plan.headline,
    detail: surviveLine,
  });
  if (plan.payNote) {
    life.log.push({
      age: life.age,
      year: plan.year,
      title: plan.payNote,
      detail: life.age < 18 ? "仍由父母供養。" : `年薪 ${Math.round(life.salary).toLocaleString("zh-HK")} ${countryById(life.countryId).ccy}。`,
    });
  }
  const report: Report = {
    age: plan.age,
    year: plan.year,
    title: plan.title ?? plan.headline,
    detail: plan.detail ?? "",
    explanation: `${plan.explanation ?? ""}${surviveLine}`,
    regimeName: plan.regimeName,
    headline: plan.headline,
    pricePct: plan.pricePct ?? 0,
    capPct: plan.capPct ?? 0,
    sharePct: plan.sharePct ?? 0,
    q: plan.q,
    roll,
    died,
    relistedTo: plan.relistedTo,
    cause: plan.cause,
    payNote: plan.payNote,
  };
  if (died) {
    life.alive = false;
    life.cause = plan.cause;
    life.deathYear = plan.year;
    life.plan = null;
  } else {
    life.age += 1;
    life.slot = 0;
    life.plan = null;
  }
  return report;
}

/** Lock a waiting choice without spending a time slot. */
export function acceptChoice(source: Life, index: number): Life {
  const life = copy(source);
  if (!life.alive) return life;
  if (!life.plan || life.plan.age !== life.age) return beginYear(life);
  if (life.plan.committed || !life.plan.eventId) return life;
  commit(life, index);
  return life;
}

/** One tenth of a year. One call per second while the market is open. */
export function advance(source: Life): { life: Life; report: Report | null } {
  if (!source.alive) return { life: source, report: null };
  let life = copy(source);
  if (!life.plan || life.plan.age !== life.age) life = beginYear(life);
  const plan = life.plan;
  if (!plan) return { life, report: null };
  if (plan.eventId && !plan.committed) return { life: source, report: null };
  if (!plan.committed) commit(life, null);
  if ((life.slot ?? 0) >= 10) {
    const report = closeYear(life);
    return { life: report.died ? life : beginYear(life), report };
  }
  life.slot = (life.slot ?? 0) + 1;
  paintSlot(life);
  return { life, report: null };
}

export function choose(source: Life, index: number | null): { life: Life; report: Report } {
  let life = copy(source);
  if (!life.plan || life.plan.age !== life.age) life = beginYear(life);
  if (life.plan?.eventId && !life.plan.committed) {
    if (index === null) throw new Error("choice required");
    commit(life, index);
  }
  let report: Report | null = null;
  for (let i = 0; i < 12; i += 1) {
    const step = advance(life);
    life = step.life;
    if (step.report) {
      report = step.report;
      break;
    }
  }
  if (!report) throw new Error("year did not close");
  return { life, report };
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
    if (!life.alive || !life.plan || life.plan.eventId) break;
    const step = choose(life, null);
    reports.push(step.report);
    life = step.life;
    if (!life.alive || life.plan?.eventId) break;
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
    while (life.alive && life.plan && guard < 130) {
      guard += 1;
      const choices = currentChoices(life);
      const index = choices.length ? Math.floor(draw(life) * choices.length) : null;
      life = choose(life, index).life;
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
