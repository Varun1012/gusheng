import { countryById } from "@/game/countries";
import type { PolicyId } from "@/game/types";

/** Modern (circa 2020) base qx, then scaled by calendar year. */
export function baseQx(countryId: string, age: number, year: number): number {
  const p = countryById(countryId);
  let q: number;
  if (age <= 0) q = p.q0;
  else if (age < 15) q = p.qChild * (age < 5 ? 1.5 : 1);
  else {
    let mu = p.A + p.R * Math.exp(p.B * age);
    if (p.mid !== 1 && age >= 22 && age <= 44 && year >= 1990) mu *= p.mid;
    q = 1 - Math.exp(-mu);
  }

  const back = Math.max(0, 2020 - year);
  if (age <= 0) q = Math.min(0.22, q * Math.pow(2, back / 14));
  else if (age < 15) q = Math.min(0.15, q * (1 + back / 26));
  else q = Math.min(0.72, q * (1 + back / 70));

  q *= conflictMultiplier(countryId, year, age);
  if (age >= 108) q = Math.max(q, 0.55);
  if (age >= 112) q = 0.92;
  return Math.min(0.92, q);
}

export function conflictMultiplier(countryId: string, year: number, age: number): number {
  const civilian = age < 15 || age > 50;
  const east = year >= 1937 && year <= 1945 && ["cn", "jp", "hk", "tw", "kr"].includes(countryId);
  const euro = year >= 1939 && year <= 1945 && ["gb", "de"].includes(countryId);
  const pacific = year >= 1941 && year <= 1945 && countryId === "us";
  const biafra = countryId === "ng" && year >= 1967 && year <= 1970;
  if (east) return civilian ? 1.7 : 3.1;
  if (euro) return civilian ? 1.55 : countryId === "de" ? 3.2 : 2.3;
  if (pacific) return civilian ? 1.04 : 1.45;
  if (biafra) return civilian ? 1.45 : 2.1;
  return 1;
}

export function mortalityQx(
  countryId: string,
  age: number,
  year: number,
  health: number,
  policy: PolicyId,
): number {
  let q = baseQx(countryId, age, year);
  const h = Math.max(0, Math.min(100, health));
  const healthMult = 0.7 + Math.pow((100 - h) / 100, 1.35) * 1.9;
  q *= healthMult;
  if (policy === "health") q *= 0.78;
  return Math.min(0.92, q);
}

export function naturalCause(age: number, countryId: string, year: number, roll: number): string {
  if (conflictMultiplier(countryId, year, age) > 1.6 && age >= 15 && age <= 50 && roll < 0.55) {
    return "戰亂";
  }
  if (age < 1) return "嬰兒期疾病";
  if (age < 5) return "幼兒重症";
  if (age < 18) return roll < 0.5 ? "意外" : "重症";
  if (age < 40) return roll < 0.45 ? "意外" : "急症";
  if (age < 55) return (["心血管急症", "癌症", "意外"] as const)[Math.floor(roll * 3) % 3];
  if (age < 75) return (["癌症", "心臟病", "中風"] as const)[Math.floor(roll * 3) % 3];
  return (["肺炎", "循環系統衰竭", "衰老", "癌症"] as const)[Math.floor(roll * 4) % 4];
}
