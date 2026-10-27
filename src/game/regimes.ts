import type { Exposure, RegimeId } from "@/game/types";

export const REGIME_NAME: Record<RegimeId, string> = {
  expansion: "擴張",
  bubble: "泡沫",
  recession: "衰退",
  crisis: "危機",
  stagflation: "滯脹",
  recovery: "復甦",
  tightening: "緊縮",
  deflation: "通縮",
};

/** Scalar on a choice's positive bet. Negative means that exposure loses money. */
export const REGIME_SCALAR: Record<RegimeId, Record<Exposure, number>> = {
  expansion: {
    leverage: 1.15,
    cash: 0.45,
    human: 1.2,
    health: 0.55,
    diversify: 0.85,
    venture: 1.35,
    real: 1.1,
    career: 1,
  },
  bubble: {
    leverage: 1.9,
    cash: 0.12,
    human: 0.65,
    health: 0.35,
    diversify: 0.5,
    venture: 1.85,
    real: 1.7,
    career: 0.48,
  },
  recession: {
    leverage: -0.4,
    cash: 1.1,
    human: 0.85,
    health: 0.7,
    diversify: 0.95,
    venture: 0.05,
    real: 0.2,
    career: 1.15,
  },
  crisis: {
    leverage: -1.25,
    cash: 1.5,
    human: 0.55,
    health: 0.9,
    diversify: 1.05,
    venture: -0.85,
    real: -0.9,
    career: 0.85,
  },
  stagflation: {
    leverage: -0.5,
    cash: 0.75,
    human: 0.9,
    health: 0.75,
    diversify: 0.85,
    venture: 0.15,
    real: 0.1,
    career: 0.7,
  },
  recovery: {
    leverage: 1.5,
    cash: 0.45,
    human: 1.3,
    health: 0.6,
    diversify: 0.95,
    venture: 1.55,
    real: 1.3,
    career: 1.05,
  },
  tightening: {
    leverage: -0.85,
    cash: 1.2,
    human: 1.05,
    health: 0.65,
    diversify: 0.95,
    venture: 0.2,
    real: -0.6,
    career: 1.05,
  },
  deflation: {
    leverage: -0.3,
    cash: 1.05,
    human: 0.7,
    health: 0.7,
    diversify: 0.75,
    venture: 0.05,
    real: -0.4,
    career: 0.8,
  },
};

export const REGIME_DRIFT: Record<RegimeId, number> = {
  expansion: 0.028,
  bubble: 0.05,
  recession: -0.02,
  crisis: -0.048,
  stagflation: -0.008,
  recovery: 0.038,
  tightening: -0.016,
  deflation: -0.004,
};

interface Rule {
  from: number;
  to: number;
  id: RegimeId;
  headline: string;
  countries?: string[];
  exclude?: string[];
}

const RULES: Rule[] = [
  {
    from: 1937,
    to: 1945,
    countries: ["cn", "jp", "hk", "tw", "kr"],
    id: "crisis",
    headline: "戰爭吞沒東亞，人命與資產被放在同一張報價單",
  },
  {
    from: 1939,
    to: 1945,
    countries: ["gb", "de", "us"],
    id: "crisis",
    headline: "全球戰爭，市場把位子讓給軍火與配給",
  },
  {
    from: 1929,
    to: 1932,
    id: "crisis",
    headline: "大蕭條，股價、就業與信用一起坍縮",
  },
  {
    from: 1973,
    to: 1974,
    id: "crisis",
    headline: "石油禁運，增長失速，物價卻不退",
  },
  {
    from: 1985,
    to: 1989,
    countries: ["jp"],
    id: "bubble",
    headline: "廣場協議之後的日本，土地與股票互相抵押",
  },
  {
    from: 1997,
    to: 1998,
    countries: ["hk", "kr", "tw", "sg", "jp"],
    id: "crisis",
    headline: "亞洲金融風暴，外資撤離，匯率與樓市同時受審",
  },
  {
    from: 2003,
    to: 2003,
    countries: ["hk", "cn", "sg", "tw"],
    id: "recession",
    headline: "非典型肺炎，城市的現金流被按下暫停",
  },
  {
    from: 2008,
    to: 2009,
    id: "crisis",
    headline: "金融海嘯，信貸凍結，槓桿被強制平倉",
  },
  {
    from: 2014,
    to: 2016,
    countries: ["br"],
    id: "crisis",
    headline: "巴西衰退與政治危機，貨幣和就業一起下修",
  },
  {
    from: 2015,
    to: 2015,
    countries: ["cn"],
    id: "crisis",
    headline: "A 股泡沫破裂，槓桿資金被清洗",
  },
  {
    from: 2019,
    to: 2019,
    countries: ["hk"],
    id: "recession",
    headline: "社會震盪，零售、旅遊與樓市估值下調",
  },
  {
    from: 2020,
    to: 2020,
    id: "crisis",
    headline: "疫情停擺。市場先跌，再被流動性抬起",
  },
  {
    from: 2021,
    to: 2023,
    countries: ["cn", "hk"],
    id: "tightening",
    headline: "地產去槓桿，舊的增長模式被重估",
  },
  {
    from: 2021,
    to: 2021,
    id: "bubble",
    headline: "超寬貨幣，風險資產幾乎沒有折現率",
  },
  {
    from: 2022,
    to: 2023,
    id: "tightening",
    headline: "數十年來最快的加息，久期與槓桿一起受傷",
  },
  {
    from: 1990,
    to: 2012,
    countries: ["jp"],
    id: "deflation",
    headline: "失落的資產負債表，現金比夢想貴重",
  },
  {
    from: 1992,
    to: 2007,
    countries: ["cn"],
    id: "expansion",
    headline: "改革開放的紅利還在擴表，政策就是Beta",
  },
  {
    from: 1992,
    to: 2007,
    countries: ["in"],
    id: "expansion",
    headline: "自由化之後的印度，增長快，波動也快",
  },
  {
    from: 1975,
    to: 1982,
    id: "stagflation",
    headline: "停滯通脹：物價在漲，機會沒有",
  },
  {
    from: 1999,
    to: 2000,
    id: "bubble",
    headline: "科網狂熱，沒有盈利的故事也能上市",
  },
  {
    from: 2001,
    to: 2002,
    id: "recession",
    headline: "科網破滅，招聘廣告先消失",
  },
  {
    from: 1946,
    to: 1972,
    id: "expansion",
    headline: "戰後擴張，勞動力比金融工程更值錢",
  },
  {
    from: 1983,
    to: 1989,
    id: "expansion",
    headline: "利率下行的十年，風險資產開始習慣上漲",
  },
  {
    from: 1992,
    to: 1998,
    id: "expansion",
    headline: "全球化擴張，資本跨過邊境找增長",
  },
  {
    from: 2003,
    to: 2007,
    id: "expansion",
    headline: "大緩和的尾聲，槓桿看起來很溫柔",
  },
  {
    from: 2010,
    to: 2019,
    id: "expansion",
    headline: "量化寬鬆的長牛，現金是一種拖累",
  },
  {
    from: 2024,
    to: 2026,
    id: "expansion",
    headline: "高利率下的軟著陸，估值不再免費",
  },
];

const FUTURE: { id: RegimeId; headline: string }[] = [
  { id: "expansion", headline: "模型裡的擴張年：信貸鬆一點，故事就漲" },
  { id: "expansion", headline: "模型裡的擴張年：就業還在，倍數溫和" },
  { id: "bubble", headline: "模型裡的泡沫年：人人覺得自己看懂了週期" },
  { id: "tightening", headline: "模型裡的緊縮年：折現率回來討債" },
  { id: "recession", headline: "模型裡的衰退年：訂單先取消，股價後知後覺" },
  { id: "recovery", headline: "模型裡的復甦年：最差的新聞已經登出" },
  { id: "crisis", headline: "模型裡的危機年：相關性變成 1" },
  { id: "recovery", headline: "模型裡的修復年：存活本身開始被重估" },
];

const AIR: Record<RegimeId, string> = {
  expansion: "市道偏暖。工作還找得到，人家也比較敢花錢。",
  bubble: "價格跑在收入前面。周圍的人都覺得自己看懂了。",
  recession: "訂單少了。家裡比新聞更早感覺到。",
  crisis: "信用變貴，外面很吵。家裡的帳先緊起來。",
  stagflation: "東西貴了，機會卻沒有一起來。",
  recovery: "最壞的日子像是過去了，還沒好到可以揮霍。",
  tightening: "借錢變得不舒服，能拖的開支都在拖。",
  deflation: "東西便宜，人也變得不敢動。",
};

export function regimeFor(year: number, countryId: string): {
  id: RegimeId;
  name: string;
  headline: string;
} {
  if (year > 2026) {
    const item = FUTURE[(year - 2027) % FUTURE.length]!;
    return { id: item.id, name: REGIME_NAME[item.id], headline: AIR[item.id] };
  }
  for (const rule of RULES) {
    if (year < rule.from || year > rule.to) continue;
    if (rule.countries && !rule.countries.includes(countryId)) continue;
    if (rule.exclude && rule.exclude.includes(countryId)) continue;
    return { id: rule.id, name: REGIME_NAME[rule.id], headline: AIR[rule.id] };
  }
  return {
    id: "expansion",
    name: REGIME_NAME.expansion,
    headline: AIR.expansion,
  };
}
