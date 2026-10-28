import { childName, personName } from "@/game/names";
import type { Kin, Life, TierId } from "@/game/types";

const PARENT_NOTE: Record<TierId, [string, string]> = {
  destitute: ["打散工", "幫人看孩子、做家務"],
  poor: ["體力活", "把家裡的伙食記到分"],
  modest: ["有穩定班次", "管家裡的日常"],
  middle: ["受薪上班", "受薪上班"],
  affluent: ["家族的舖和樓", "家族的舖和樓"],
  dynasty: ["家族辦公室", "信託和舊物業"],
};

function uniqueName(countryId: string, rng: () => number, taken: Set<string>): string {
  for (let i = 0; i < 8; i += 1) {
    const name = personName(countryId, rng);
    if (!taken.has(name)) {
      taken.add(name);
      return name;
    }
  }
  const name = personName(countryId, rng);
  taken.add(name);
  return name;
}

function push(list: Kin[], person: Kin) {
  list.push(person);
}

/** Parents and older siblings at birth. Some may already be gone. */
export function seedHousehold(life: Life, rng: () => number): Kin[] {
  const taken = new Set<string>([life.name]);
  const year = life.birthYear;
  const notes = PARENT_NOTE[life.tier];
  const list: Kin[] = [];

  const fatherAge = 26 + Math.floor(rng() * 16);
  const motherAge = 22 + Math.floor(rng() * 14);
  const fatherDead = rng() < 0.08;
  const motherDead = !fatherDead && rng() < 0.08;

  push(list, {
    role: "father",
    tag: "父",
    name: uniqueName(life.countryId, rng, taken),
    born: year - fatherAge,
    died: fatherDead ? year - (1 + Math.floor(rng() * 6)) : undefined,
    alive: !fatherDead,
    note: notes[0],
  });
  push(list, {
    role: "mother",
    tag: "母",
    name: uniqueName(life.countryId, rng, taken),
    born: year - motherAge,
    died: motherDead ? year - (1 + Math.floor(rng() * 6)) : undefined,
    alive: !motherDead,
    note: notes[1],
  });

  const father = list[0]!;
  const siblings = rng() < 0.34 ? 0 : rng() < 0.72 ? 1 : 2;
  for (let i = 0; i < siblings; i += 1) {
    const older = 2 + Math.floor(rng() * 12);
    const dead = rng() < 0.06;
    const sister = rng() < 0.5;
    let name = childName(life.countryId, father.name, rng);
    for (let n = 0; n < 6 && taken.has(name); n += 1) name = childName(life.countryId, father.name, rng);
    taken.add(name);
    push(list, {
      role: "sibling",
      tag: sister ? "姐" : "兄",
      name,
      born: year - older,
      died: dead ? year - (1 + Math.floor(rng() * Math.max(1, older - 1))) : undefined,
      alive: !dead,
      note: "一起長大",
    });
  }
  return list;
}

export function childCount(life: Life): number {
  return (life.household ?? []).filter((person) => person.role === "child").length;
}

export function attachSpouse(life: Life, rng: () => number) {
  const year = life.plan?.year ?? life.birthYear + life.age;
  const taken = new Set((life.household ?? []).map((person) => person.name));
  taken.add(life.name);
  const gap = Math.floor(rng() * 9) - 4;
  const born = year - Math.max(18, life.age + gap);
  const notes = ["有自己的工作", "在家裡多一點", "跟你不是同行", "收入不穩，人還在"];
  const person: Kin = {
    role: "spouse",
    tag: "配偶",
    name: uniqueName(life.countryId, rng, taken),
    born,
    alive: true,
    note: notes[Math.floor(rng() * notes.length)] ?? notes[0],
  };
  life.household = [...(life.household ?? []), person];
}

export function partSpouse(life: Life) {
  life.household = (life.household ?? []).map((person) =>
    person.role === "spouse" && person.alive && !person.apart
      ? { ...person, apart: true, note: "已經分開" }
      : person,
  );
}

export function attachChild(life: Life, rng: () => number) {
  const year = life.plan?.year ?? life.birthYear + life.age;
  const girl = rng() < 0.5;
  const parent = life.name;
  const taken = new Set((life.household ?? []).map((person) => person.name));
  let name = childName(life.countryId, parent, rng);
  for (let i = 0; i < 6 && taken.has(name); i += 1) name = childName(life.countryId, parent, rng);
  const person: Kin = {
    role: "child",
    tag: girl ? "女" : "子",
    name,
    born: year,
    alive: true,
    note: girl ? "女兒" : "兒子",
  };
  life.household = [...(life.household ?? []), person];
}

function deathChance(age: number): number {
  if (age <= 0) return 0.012;
  if (age < 5) return 0.006;
  if (age < 15) return 0.0012;
  if (age < 40) return 0.0014;
  if (age < 55) return 0.004;
  if (age < 70) return 0.016;
  if (age < 80) return 0.045;
  if (age < 90) return 0.1;
  return 0.22;
}

function wound(role: Kin["role"], apart?: boolean): [number, number] {
  if (role === "child") return [12, 10];
  if (role === "spouse") return apart ? [3, 2] : [10, 8];
  if (role === "father" || role === "mother") return [8, 6];
  return [4, 3];
}

/** Once a year. Marks deaths in place and returns a line for the log. */
export function ageHousehold(life: Life, rng: () => number): string {
  const year = life.plan?.year ?? life.birthYear + life.age;
  const lines: string[] = [];
  for (const person of life.household ?? []) {
    if (!person.alive) continue;
    const age = year - person.born;
    if (rng() >= deathChance(age)) continue;
    person.alive = false;
    person.died = year;
    const [kinHit, mindHit] = wound(person.role, person.apart);
    life.kin = Math.max(0, life.kin - kinHit);
    life.mind = Math.max(0, life.mind - mindHit);
    const span = age <= 0 ? "未滿一歲" : `享年 ${age}`;
    lines.push(`${person.tag} · ${person.name}離世，${span}`);
  }
  return lines.join("。");
}

/** Fill household on old saves without touching the live random stream. */
export function hydrateHousehold(life: Life) {
  let state = (life.seed ^ 0x6d2b79f5) >>> 0;
  const rng = () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  if (!life.household || life.household.length === 0) life.household = seedHousehold(life, rng);
  if (life.flags?.married && !life.household.some((person) => person.role === "spouse")) attachSpouse(life, rng);
  if (life.flags?.children && childCount(life) === 0) attachChild(life, rng);
}
