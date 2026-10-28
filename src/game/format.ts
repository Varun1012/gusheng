import { countryById } from "@/game/countries";
import { tierLabel } from "@/game/names";
import type { Life } from "@/game/types";

export function formatPct(x: number): string {
  const p = x * 100;
  const sign = p > 0 ? "+" : "";
  return `${sign}${p.toFixed(1)}%`;
}

export function formatMultiple(x: number): string {
  if (!Number.isFinite(x)) return "—";
  const sign = x < 0 ? "-" : "";
  const v = Math.abs(x);
  const digits = v >= 10 ? 1 : 2;
  return `${sign}×${v.toFixed(digits)}`;
}

export function formatPrice(n: number): string {
  const abs = Math.abs(n);
  const digits = abs >= 1000 ? 0 : abs >= 100 ? 1 : 2;
  return n.toLocaleString("zh-HK", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function formatMoney(n: number): string {
  return Math.round(Math.max(0, n)).toLocaleString("zh-HK");
}

export function formatCompact(n: number): string {
  const sign = n < 0 ? "-" : "";
  const a = Math.abs(n);
  if (a >= 1e12) return sign + trim(a / 1e12) + "兆";
  if (a >= 1e8) return sign + trim(a / 1e8) + "億";
  if (a >= 1e4) return sign + trim(a / 1e4) + "萬";
  if (a >= 100) return sign + a.toFixed(0);
  return sign + trim(a);
}

function trim(n: number): string {
  if (n >= 100) return n.toFixed(0);
  if (n >= 10) return n.toFixed(1);
  return n.toFixed(2);
}

export function capLocal(life: Life): number {
  return life.price * life.shares;
}

export function capUsd(life: Life): number {
  return capLocal(life) / countryById(life.countryId).fx;
}

export function priceUsd(life: Life): number {
  return life.price / countryById(life.countryId).fx;
}

export function capMultiple(life: Life): number {
  return capUsd(life) / life.ipoCapUsd;
}

export function priceMultiple(life: Life): number {
  return priceUsd(life) / life.ipoPriceUsd;
}

export function scoreOf(life: Life): number {
  const capMult = capMultiple(life);
  const pxMult = priceMultiple(life);
  const usd = capUsd(life);
  return Math.round(
    Math.log10(Math.max(usd, 1)) * 50 +
      Math.log10(Math.max(capMult, 0.05)) * 40 +
      Math.log10(Math.max(pxMult, 0.05)) * 28 +
      Math.min(life.age, 100) * 0.6,
  );
}

export interface Epitaph {
  grade: string;
  title: string;
  text: string;
  score: number;
}

export function epitaph(life: Life): Epitaph {
  const capMult = capMultiple(life);
  const pxMult = priceMultiple(life);
  const shareMult = life.shares / life.ipoShares;
  const peakDrop = life.peakCapUsd / Math.max(capUsd(life), 1);
  const place = countryById(life.countryId).name;
  const tier = tierLabel(life.tier);
  const score = scoreOf(life);

  let grade = "普通股";
  let title = "平淡收盤";
  let text = `出身${tier}，在${place}掛牌 ${life.age} 年。市值是開盤的 ${formatMultiple(capMult)}，股價是開盤的 ${formatMultiple(pxMult)}。`;

  if (life.age < 1) {
    grade = "未成交";
    title = "上市當日除牌";
    text = `在${place}，出生當年的死亡率不是零。這不是選擇輸了，是起點的定價。`;
  } else if (life.age < 30) {
    grade = "夭折";
    title = "故事短於一個週期";
    text = `掛牌 ${life.age} 年就停牌。${life.cause ?? "未知"}。時間不夠把出身換成複利。`;
  } else if (shareMult > 2.6 && pxMult < 0.85 && capMult > 1.4) {
    grade = "注水";
    title = "市值靠增發堆出來";
    text = `流通股變成開盤的 ${formatMultiple(shareMult)}，股價卻是 ${formatMultiple(pxMult)}。市值好看，每一股變薄了。`;
  } else if (pxMult >= 6 && capMult >= 6 && life.age >= 68) {
    grade = "藍籌";
    title = "長命，而且貴";
    text = `股價與市值一起重估，而且你活到了可以領取複利的年紀。這是這隻股票最貴的品質。`;
  } else if (capMult >= 12 && pxMult >= 3) {
    grade = "十倍股";
    title = "一生被重估";
    text = `從${tier}起步，市值來到開盤的 ${formatMultiple(capMult)}。市場最後相信的是你的基本面，不只是出身。`;
  } else if (peakDrop >= 5 && life.peakCapUsd > life.ipoCapUsd * 2) {
    grade = "泡沫遺民";
    title = "高點留在舊報價";
    text = `峰值市值是終值的 ${formatMultiple(peakDrop)}。你曾經很貴，除牌時市場不再這麼認為。`;
  } else if (pxMult < 0.3) {
    grade = "仙股";
    title = "報價薄得透光";
    text = `股價只剩開盤的 ${formatMultiple(pxMult)}。市值 ${formatMultiple(capMult)}。名字還在，買盤不在。`;
  } else if (life.age >= 85 && capMult >= 1.2) {
    grade = "長壽溢價";
    title = "時間是最大的一筆複利";
    text = `你活過了${place}大多數同齡人。終值沒有傳奇，但存續本身就是超額回報。`;
  } else if (capMult >= 4) {
    grade = "成長股";
    title = "市值跑贏了出身";
    text = `終值是開盤市值的 ${formatMultiple(capMult)}，股價 ${formatMultiple(pxMult)}。不是神話，是一條向上的生命線。`;
  } else if (capMult < 0.45) {
    grade = "價值陷阱";
    title = "基本面沒有回來";
    text = `市值萎縮到開盤的 ${formatMultiple(capMult)}。政策、年份與槓桿，有一個一直站在你對面。`;
  }

  return { grade, title, text, score };
}

export function formatQ(q: number): string {
  if (q < 0.0001) return "低於 0.01%";
  if (q < 0.01) return `${(q * 100).toFixed(2)}%`;
  return `${(q * 100).toFixed(1)}%`;
}
