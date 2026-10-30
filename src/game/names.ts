import { TIER_LABEL, countryById } from "@/game/countries";
import type { TierId } from "@/game/types";

function pick<T>(rng: () => number, list: readonly T[]): T {
  return list[Math.floor(rng() * list.length)]!;
}

const CN_SUR = ["陳", "林", "黃", "張", "李", "王", "吳", "劉", "蔡", "楊", "鄭", "周", "徐", "孫", "馬", "朱", "胡", "高", "郭", "何", "羅", "梁", "宋", "唐", "韓", "馮", "鄧", "曹", "彭", "蕭", "潘", "袁", "葉", "杜", "程", "魏", "呂", "丁", "任", "沈", "姚", "盧", "姜", "崔", "譚", "汪", "范", "金", "廖", "夏", "方", "鄒", "熊", "秦", "江", "尹", "白", "孟", "雷", "侯", "龍", "史", "賀", "顧", "龔", "邵", "萬", "錢", "嚴", "戴", "孔"];
const CN_GIVEN = ["予安", "曉桐", "澄", "沐言", "知行", "望川", "初寧", "恩希", "遠", "朗", "安", "書衡", "以寧", "景行", "清和", "南星", "照", "晚寧", "修遠", "言蹊", "承澤", "簡", "寧", "川", "予", "希", "行"];

const JP_SUR = ["佐藤", "鈴木", "高橋", "田中", "伊藤", "渡邊", "山本", "中村", "小林", "加藤", "吉田", "山田", "松本"];
const JP_GIVEN = ["蓮", "陽菜", "樹", "葵", "湊", "結衣", "蒼", "凜", "咲", "大翔"];

const KR = ["金敏俊", "朴書妍", "李道允", "崔智恩", "鄭宇彬", "姜河那", "趙恩采", "尹時雨", "韓道英", "吳世琳"];

const IN = ["Aarav Sharma", "Priya Patel", "Rahul Singh", "Ananya Iyer", "Vikram Mehta", "Neha Gupta", "Arjun Reddy", "Meera Nair"];
const NG = ["Adaeze Okonkwo", "Chinedu Adeyemi", "Funke Balogun", "Tunde Lawal", "Amaka Eze", "Ibrahim Danjuma"];
const BR = ["Marina Silva", "Lucas Ferreira", "Beatriz Souza", "Gabriel Costa", "Juliana Almeida", "Pedro Rocha"];
const DE = ["Lena Hoffmann", "Jonas Weber", "Mia Schneider", "Felix Becker", "Hannah Kruger", "Paul Fischer"];
const GB = ["Oliver Clarke", "Amelia Wright", "Harry Bennett", "Sophie Turner", "George Hall", "Isla Morgan"];
const US = ["Maya Chen", "James Porter", "Elena Vasquez", "Noah Williams", "Aisha Rahman", "Daniel Cho", "Grace Miller", "Leo Andersen"];
const FR = ["Camille Laurent", "Lucas Bernard", "Chloé Moreau", "Hugo Petit", "Léa Dubois", "Adam Roux"];
const IT = ["Giulia Rossi", "Marco Bianchi", "Francesca Romano", "Luca Ferrari", "Chiara Greco", "Andrea Conti"];
const CA = ["Noah Tremblay", "Olivia Martin", "Liam Singh", "Emma Gagnon", "Ethan Brown", "Sofia Chen"];
const AU = ["Jack Wilson", "Chloe Harris", "Liam Nguyen", "Mia Thompson", "Oliver Kelly", "Zoe Campbell"];
const IDN = ["Siti Rahmawati", "Budi Santoso", "Dewi Lestari", "Agus Wijaya", "Putri Anggraini", "Rizky Pratama"];
const MX = ["Sofía Hernández", "Diego Ramírez", "Valentina García", "Mateo López", "Camila Torres", "Santiago Cruz"];
const PH = ["Maria Santos", "Jose Reyes", "Angel Cruz", "Patricia Garcia", "Miguel Flores", "Liza Mendoza"];
const EG = ["Omar Hassan", "Fatima Ali", "Yusuf Mahmoud", "Nour Ibrahim", "Layla Farouk", "Karim Adel"];
const TH = ["Somchai Wattana", "Siriporn Chai", "Anong Srisai", "Niran Boonmee", "Malee Phan", "Krit Thongchai"];
const VN = ["Nguyen Minh Anh", "Tran Gia Huy", "Le Thanh Ha", "Pham Quoc Bao", "Vo Ngoc Lan", "Bui Duc Nam"];
const MY = ["Aisyah Rahman", "Wei Jun Tan", "Nurul Idris", "Kavitha Nair", "Hafiz Abdullah", "Mei Ling Ong"];
const ZA = ["Thabo Nkosi", "Amahle Dlamini", "Johan Botha", "Lerato Molefe", "Fatima Peters", "Sipho Khumalo"];
const TR = ["Elif Yilmaz", "Mehmet Demir", "Zeynep Kaya", "Emre Sahin", "Ayşe Aydin", "Can Ozturk"];
const ES = ["Lucía García", "Mateo Ruiz", "Sofía Navarro", "Hugo Ortega", "Marta Vidal", "Pablo Serrano"];
const SE = ["Astrid Lind", "Erik Holm", "Freja Berg", "Noah Ek", "Maja Ström", "Oscar Nyström"];
const PL = ["Zofia Kowalska", "Jan Nowak", "Hanna Wisniewska", "Piotr Zielinski", "Maja Wójcik", "Adam Kaminski"];
const KE = ["Amina Otieno", "Brian Mwangi", "Wanjiku Kariuki", "David Kipchoge", "Achieng Oduya", "Faith Wambui"];
const PK = ["Ayesha Khan", "Hassan Malik", "Fatima Raza", "Omar Sheikh", "Zara Hussain", "Bilal Ahmed"];

export function personName(countryId: string, rng: () => number): string {
  if (countryId === "jp") return pick(rng, JP_SUR) + pick(rng, JP_GIVEN);
  if (countryId === "kr") return pick(rng, KR);
  if (countryId === "in") return pick(rng, IN);
  if (countryId === "ng") return pick(rng, NG);
  if (countryId === "br") return pick(rng, BR);
  if (countryId === "de") return pick(rng, DE);
  if (countryId === "gb") return pick(rng, GB);
  if (countryId === "us") return pick(rng, US);
  if (countryId === "fr") return pick(rng, FR);
  if (countryId === "it") return pick(rng, IT);
  if (countryId === "ca") return pick(rng, CA);
  if (countryId === "au") return pick(rng, AU);
  if (countryId === "id") return pick(rng, IDN);
  if (countryId === "mx") return pick(rng, MX);
  if (countryId === "ph") return pick(rng, PH);
  if (countryId === "eg") return pick(rng, EG);
  if (countryId === "th") return pick(rng, TH);
  if (countryId === "vn") return pick(rng, VN);
  if (countryId === "my") return pick(rng, MY);
  if (countryId === "za") return pick(rng, ZA);
  if (countryId === "tr") return pick(rng, TR);
  if (countryId === "es") return pick(rng, ES);
  if (countryId === "se") return pick(rng, SE);
  if (countryId === "pl") return pick(rng, PL);
  if (countryId === "ke") return pick(rng, KE);
  if (countryId === "pk") return pick(rng, PK);
  return pick(rng, CN_SUR) + pick(rng, CN_GIVEN);
}

/** A child's name. Shares the family name where the culture puts it first or last. */
export function childName(countryId: string, parentName: string, rng: () => number): string {
  const full = personName(countryId, rng);
  if (countryId === "jp") return parentName.slice(0, 2) + full.slice(2);
  if (countryId === "kr") return parentName.slice(0, 1) + full.slice(1);
  const latin = full.includes(" ");
  if (!latin) return parentName.slice(0, 1) + full.slice(1);
  const last = parentName.split(" ").slice(-1)[0] ?? parentName;
  const first = full.split(" ")[0] ?? full;
  return `${first} ${last}`;
}

const FAMILY: Record<TierId, string[]> = {
  destitute: [
    "父母打散工，家裡沒有多餘的一頓",
    "你出生在出租房間，第一筆資產是別人的空氣",
    "家族沒有存款，只有還沒結清的數",
  ],
  poor: [
    "父親做體力活，母親把伙食費記到分",
    "屋裡有一張餐桌，沒有一張股票",
    "親戚能借到的，只是一個月的糧",
  ],
  modest: [
    "父母有穩定班次，也有穩定的擔憂",
    "家裡供得起書本，供不起失誤",
    "儲蓄薄薄一層，剛好蓋住小病",
  ],
  middle: [
    "父母是受薪專業人士，假期要提前申請",
    "有自住的地方，也有還沒供完的年月",
    "伙食之外，還有一點可以投資的餘裕",
  ],
  affluent: [
    "家族有舖有樓，數字從你記事前就在滾",
    "父母談事情用「倉位」，不用「薪水」",
    "你的起點已經是別人的目標價",
  ],
  dynasty: [
    "家族名字本身就像一隻老牌藍籌",
    "你出生時，信託已比你更年長",
    "開曼、家族辦公室、舊相簿，三樣都有",
  ],
};

const LOCAL: Partial<Record<string, Partial<Record<TierId, string[]>>>> = {
  hk: {
    dynasty: ["家族在中環有舊樓，租約比你更年長"],
    destitute: ["劏房的燈先於你亮起，也比你更晚熄"],
  },
  us: {
    poor: ["父母沒有完整醫保，你的第一個風險因子是帳單"],
    dynasty: ["家族基金的季報，比你的出生紙更厚"],
  },
  jp: {
    middle: ["父親是終身僱用制的一代，你不是"],
  },
  ng: {
    destitute: ["市電不穩，家人用發電機計算夜晚"],
    affluent: ["家族做進出口，匯率就是家裡的天氣"],
  },
  in: {
    modest: ["一家人的希望押在下一張考試卷"],
    dynasty: ["家族企業的股權表上，已有你的名字"],
  },
  cn: {
    poor: ["戶口在小城，機會的報價在別處"],
    affluent: ["父母赶上了第一波廠房與土地"],
  },
};

export function familyLine(countryId: string, tier: TierId, rng: () => number): string {
  const local = LOCAL[countryId]?.[tier];
  if (local && rng() < 0.55) return pick(rng, local);
  return pick(rng, FAMILY[tier]);
}

export function tickerOf(countryId: string, name: string, rng: () => number): string {
  const c = countryById(countryId);
  let core: string;
  if (c.numeric) {
    core = String(1000 + Math.floor(rng() * 9000));
  } else {
    const letters = name.toUpperCase().replace(/[^A-Z]/g, "");
    if (letters.length >= 3) core = letters.slice(0, 4);
    else {
      const alphabet = "ABCDEFGHJKLMNPRSTUVWXYZ";
      core = Array.from({ length: 4 }, () => alphabet[Math.floor(rng() * alphabet.length)]).join("");
    }
  }
  return c.suffix ? `${core}.${c.suffix}` : core;
}

export function reticker(ticker: string, countryId: string): string {
  const c = countryById(countryId);
  const core = ticker.split(".")[0] ?? ticker;
  return c.suffix ? `${core}.${c.suffix}` : core;
}

export function tierLabel(tier: TierId): string {
  return TIER_LABEL[tier];
}
