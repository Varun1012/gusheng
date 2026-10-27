import type { Exposure, PolicyId } from "@/game/types";

export interface Policy {
  id: PolicyId;
  name: string;
  blurb: string;
  exposure: Exposure;
}

export const POLICIES: Policy[] = [
  { id: "cash", name: "現金堡壘", blurb: "危機少輸，泡沫少賺", exposure: "cash" },
  { id: "leverage", name: "槓桿進取", blurb: "順風放大，逆風加虧", exposure: "leverage" },
  { id: "human", name: "人力複利", blurb: "學歷與手藝慢慢重估", exposure: "human" },
  { id: "health", name: "健康優先", blurb: "壓低死亡率，換一部分回報", exposure: "health" },
  { id: "diversify", name: "全球分散", blurb: "降低波動，必要時轉板", exposure: "diversify" },
  { id: "venture", name: "創業集中", blurb: "高貝塔，成敗都極端", exposure: "venture" },
];

export const POLICY_BETA: Record<PolicyId, number> = {
  cash: 0.35,
  leverage: 1.7,
  human: 0.75,
  health: 0.55,
  diversify: 0.65,
  venture: 1.45,
};

export const POLICY_VOL: Record<PolicyId, number> = {
  cash: 0.4,
  leverage: 1.55,
  human: 0.7,
  health: 0.5,
  diversify: 0.42,
  venture: 1.75,
};

export const EXPOSURE_NAME: Record<Exposure, string> = {
  leverage: "槓桿",
  cash: "現金",
  human: "人力",
  health: "健康",
  diversify: "分散",
  venture: "創業",
  real: "實物資產",
  career: "正職",
};

export function policyById(id: PolicyId): Policy {
  const found = POLICIES.find((p) => p.id === id);
  if (!found) throw new Error(id);
  return found;
}
