import type { ChoiceDef, GameEvent } from "@/game/event-types";
import type { Life } from "@/game/types";

export const CAREER_LABEL: Record<string, string> = {
  teacher: "教書",
  engineer: "工程",
  care: "醫護",
  clerk: "文職",
  civil: "公職",
  shop: "開店",
};

function walked(life: Life, career: string, after: string | null): boolean {
  if (life.career !== career) return false;
  if (!after) return true;
  return (life.used ?? []).includes(after);
}

function road(career: string, id: string, after: string | null, minAge: number, title: string, body: string, choices: ChoiceDef[]): GameEvent {
  return {
    id,
    title,
    body,
    choices,
    thread: true,
    major: true,
    facet: "work",
    minAge,
    weight: 3,
    when: (life) => walked(life, career, after),
  };
}

function along(
  id: string,
  after: string | null,
  minAge: number,
  title: string,
  body: string,
  choices: ChoiceDef[],
  ready: (life: Life) => boolean,
): GameEvent {
  return {
    id,
    title,
    body,
    choices,
    thread: true,
    major: true,
    facet: "work",
    minAge,
    weight: 3,
    when: (life) => ready(life) && (!after || (life.used ?? []).includes(after)),
  };
}

/** Questions that exist only because of the road already taken. Each one once, in order. */
export const CAREER_EVENTS: GameEvent[] = [
  road("teacher", "t_mark", null, 24, "成績單上有一個不該在那裡的數字", "家長、校長，或者兩邊，都想要一個更好看的結果。你知道那個學生實際做到哪裡。", [
    { label: "照實寫", detail: "名字會不好聽，卷子是真的", exposure: "human", price: 0.03, reputation: 4, mind: 2, human: 1, kin: -2 },
    { label: "改成他們要的", detail: "這一班安靜了", exposure: "career", price: 0.04, reputation: -4, mind: -3, kin: 3, social: 2 },
    { label: "把筆交給校長", detail: "決定不再是你的", exposure: "cash", price: 0.02, mind: -1, reputation: -2, human: -2 },
  ]),
  road("teacher", "t_seen", "t_mark", 31, "你看見同事在班上做的事", "不是傳聞。下了課，學生沒有說，同事也當你沒有站在門口。", [
    { label: "寫成報告", detail: "紙留了下來", exposure: "human", price: 0.03, reputation: 5, social: -4, mind: -2, human: 1 },
    { label: "私下叫停，不留紙", detail: "只在你們兩人之間", exposure: "diversify", price: 0.03, mind: 2, social: 1, reputation: -1 },
    { label: "當作那天沒有看見", detail: "走廊恢復平常", exposure: "career", price: 0.04, mind: -4, reputation: -2, social: 2 },
  ]),
  road("teacher", "t_desk", "t_seen", 38, "有人要你離開課室", "升上去就不再上課。位子、薪水、還有你原本進來教書的理由，不能一起留下。", [
    { label: "去坐那張辦公桌", detail: "管人，不再管一班", exposure: "career", price: 0.04, human: 3, reputation: 2, mind: -2, social: -1, jobUsd: 22000 },
    { label: "留在課室", detail: "課表還是你的", exposure: "human", price: 0.03, mind: 3, human: 2, reputation: -1 },
    { label: "辭掉，去考公職", detail: "另一條穩的路", exposure: "cash", price: 0.03, mind: 1, reputation: 1, human: 1, career: "civil", jobUsd: 19000, setFlags: { civil: true } },
  ]),
  road("teacher", "t_sign", "t_desk", 46, "一份成果要你的名字", "你沒有看完。學校說時間不夠，名字放上去，這一年才算數。", [
    { label: "簽", detail: "今年過得去", exposure: "career", price: 0.05, reputation: 3, mind: -4, human: -1 },
    { label: "拒簽", detail: "升遷這一年沒有你", exposure: "human", price: 0.02, reputation: 3, mind: 2, human: -2 },
    { label: "簽，但自己留一份底", detail: "名字在，話也在", exposure: "diversify", price: 0.03, reputation: 1, mind: -1, human: 2 },
  ]),
  road("teacher", "t_young", "t_sign", 54, "一個更年輕的人能上你的課", "校長沒有直說。課表已經先寫了兩個名字。", [
    { label: "把主課讓出來，改去帶人", detail: "位子還在，不再站在最前", exposure: "human", price: 0.03, human: 2, mind: 2, reputation: 2, jobUsd: 15000 },
    { label: "守住現在的課", detail: "課表不讓", exposure: "career", price: 0.04, mind: -3, reputation: -2, human: -1 },
    { label: "離開，用這門手藝自己開館", detail: "學校的名字留下", exposure: "venture", price: 0.05, mind: 1, human: 2, spendUsd: 2200, career: "shop", jobUsd: 12000, setFlags: { founder: true } },
  ]),

  road("engineer", "e_ship", null, 24, "明天要交出，你知道有一個洞", "修完會錯過發布。不修，洞會在別人手上才被看見。你的名字在那份名單裡。", [
    { label: "推遲，把洞補上", detail: "日子不漂亮", exposure: "human", price: 0.02, reputation: 4, mind: 1, human: 2, social: -2 },
    { label: "照明天交", detail: "發布日保住", exposure: "career", price: 0.06, reputation: -3, mind: -3, human: -1 },
    { label: "交出去，但把洞寫進附件", detail: "人可以說你提過", exposure: "diversify", price: 0.04, reputation: 1, mind: -2, human: 1 },
  ]),
  road("engineer", "e_name", "e_ship", 31, "專利上該有誰的名字", "做法是你晚上留下的。公司說名字屬於職位，不屬於人。", [
    { label: "爭自己的名字", detail: "位子會記得這一次", exposure: "human", price: 0.03, reputation: 3, mind: -1, human: 2, social: -2 },
    { label: "讓公司掛名", detail: "薪水單還是準時", exposure: "cash", price: 0.04, mind: -3, reputation: -2, human: -1 },
    { label: "名字並排，條件寫清楚", detail: "沒有全贏", exposure: "diversify", price: 0.04, reputation: 2, mind: 1, human: 1 },
  ]),
  road("engineer", "e_move", "e_name", 37, "上面要把團隊搬去更便宜的地方", "人還在這個城市。圖則已經按另一個時區在畫。", [
    { label: "跟著計畫把人遷走", detail: "成本表好看", exposure: "career", price: 0.05, human: 1, reputation: -2, social: -3, mind: -2 },
    { label: "留下這班人，自己扛延期", detail: "季度不好看", exposure: "human", price: 0.02, social: 3, mind: 1, reputation: 2, human: -1 },
    { label: "帶願意走的人出去自己做", detail: "公司的門不再為你開", exposure: "venture", price: 0.05, human: 2, mind: -1, spendUsd: 3000, career: "shop", jobUsd: 16000, setFlags: { founder: true } },
  ]),
  road("engineer", "e_figure", "e_move", 44, "客戶要一個你算不出來的數字", "報告明天要。那個數字能讓合約續上。你重算過，對不上。", [
    { label: "寫上他們要的", detail: "合約留著", exposure: "career", price: 0.05, reputation: -4, mind: -3, human: -1 },
    { label: "交你算出來的", detail: "合約可能斷", exposure: "human", price: 0.02, reputation: 4, mind: 2, social: -2 },
    { label: "兩個數字都附上，讓他們自己選", detail: "責任被攤開", exposure: "diversify", price: 0.03, reputation: 2, mind: -1, human: 1 },
  ]),
  road("engineer", "e_old", "e_figure", 53, "多年前你簽過的東西在現場出事", "沒有人死。有人受了傷，報告點到你的簽名。公司問你還記不記得當時為什麼放行。", [
    { label: "把當時知道的說完", detail: "包括你忽略的那一頁", exposure: "human", price: 0.02, reputation: 2, mind: -2, social: -1, human: 1 },
    { label: "只說程序都走過", detail: "句子很完整", exposure: "career", price: 0.04, reputation: -2, mind: -3 },
    { label: "去現場，剩下的職位以後再算", detail: "人先到", exposure: "health", price: 0.03, reputation: 3, health: -1, mind: 1, social: 2 },
  ]),

  road("care", "c_night", null, 24, "夜班不再是偶爾", "排班表把你的名字固定在深夜。白天的人說這是資歷。你的睡眠不這麼想。", [
    { label: "接下固定夜班", detail: "津貼進個人資金，白天拿去睡", exposure: "career", price: 0.04, human: 1, health: -3, mind: -2, social: -1, jobUsd: 26000 },
    { label: "拒絕，留在日班", detail: "資歷表不好看", exposure: "health", price: 0.02, health: 2, mind: 2, reputation: -2 },
    { label: "做半年，約好要輪回來", detail: "先給一個終點", exposure: "diversify", price: 0.03, health: -1, mind: 1, human: 1, jobUsd: 24000 },
  ]),
  road("care", "c_shift", "c_night", 31, "今晚資深的那位狀態不對", "手不穩，話也慢。病房裡還有別人要看。你說出來，這一班可能只剩你。", [
    { label: "換他下去，自己頂完", detail: "這一夜很長", exposure: "health", price: 0.02, health: -2, mind: -1, reputation: 3, social: -1, human: 1 },
    { label: "叫主管，讓紙上記下", detail: "班會被重排", exposure: "human", price: 0.03, reputation: 2, social: -3, mind: -2 },
    { label: "盯著他，不出聲", detail: "兩個人都還在班上", exposure: "career", price: 0.04, mind: -4, health: -1, reputation: -2 },
  ]),
  road("care", "c_kin", "c_shift", 38, "家屬要一個你不會做的處理", "他們很確定。你的判斷不是那樣。時間不多，走廊上還有別的床。", [
    { label: "照你的判斷做，把理由說完", detail: "家屬會恨這一刻", exposure: "human", price: 0.02, reputation: 3, mind: -1, kin: -2, human: 1 },
    { label: "照家屬的意思做", detail: "衝突先停", exposure: "real", price: 0.04, kin: 2, mind: -4, reputation: -3, health: -1 },
    { label: "找另一位醫生一起擔", detail: "決定不再只寫你的名字", exposure: "diversify", price: 0.03, mind: 1, social: 1, reputation: 1 },
  ]),
  road("care", "c_bed", "c_kin", 45, "床位不夠，有人被要求提早走", "病歷還可以再留兩天。上面的數字說今晚就要空出來。", [
    { label: "把人留下", detail: "明天的會不好開", exposure: "health", price: 0.02, reputation: 2, mind: 1, social: 1, human: -1 },
    { label: "照名額送走", detail: "表是平的", exposure: "career", price: 0.05, reputation: -3, mind: -3, human: -1 },
    { label: "留下，並把名額的事寫給外面", detail: "你會被問話", exposure: "human", price: 0.02, reputation: 3, mind: -2, social: -2 },
  ]),
  road("care", "c_body", "c_bed", 54, "你的身體不再適合夜班", "檢查沒有商量餘地。留下的位子是一張辦公桌，或者是門。", [
    { label: "去坐辦公桌，離開病房", detail: "班次正常，手不再碰病人", exposure: "career", price: 0.03, health: 3, mind: -2, human: -1, reputation: 1, jobUsd: 24000 },
    { label: "轉去公職，管別的人怎麼值班", detail: "另一種責任", exposure: "cash", price: 0.03, health: 2, mind: 1, reputation: 1, career: "civil", jobUsd: 23000, setFlags: { civil: true } },
    { label: "硬留下，直到他們不讓", detail: "還站在熟悉的燈下", exposure: "health", price: 0.04, health: -4, mind: -2, reputation: 1 },
  ]),

  road("clerk", "k_book", null, 25, "上司的數字對不上", "差一截。他說是時間問題，下個月會回來。你今天就要把表送出去。", [
    { label: "照對得上的數字送", detail: "他會先看見", exposure: "human", price: 0.02, reputation: 3, mind: -1, social: -2 },
    { label: "照他說的送", detail: "這個月過去", exposure: "career", price: 0.05, reputation: -3, mind: -3, human: -1 },
    { label: "兩個版本都留下，送出真的那份", detail: "你有底", exposure: "diversify", price: 0.03, reputation: 2, mind: -2, human: 1 },
  ]),
  road("clerk", "k_seat", "k_book", 32, "升職要你蓋住一個人", "那個同事的錯，你知道不全是他的。位子空出來，名字已經寫到你。", [
    { label: "把經過說清楚，位子不要", detail: "今年還坐原位", exposure: "human", price: 0.02, reputation: 3, social: 1, mind: 1, human: -1 },
    { label: "接下位子，不提那件事", detail: "門牌會換", exposure: "career", price: 0.05, reputation: -2, mind: -3, human: 2, social: -2, jobUsd: 26000 },
    { label: "位子可以接，但錯要寫在該寫的人上", detail: "兩邊都不舒服", exposure: "diversify", price: 0.03, reputation: 1, mind: -2, human: 1, social: -1, jobUsd: 24000 },
  ]),
  road("clerk", "k_machine", "k_seat", 39, "一套系統能做你現在的桌子", "演示很乾淨。人走了以後，錯會算在誰剩下。", [
    { label: "幫它上線，自己改去看它出錯", detail: "手藝變了", exposure: "career", price: 0.04, human: 3, mind: -1, social: -2, jobUsd: 23000 },
    { label: "找出它蓋不住的那一截，寫下來", detail: "桌子暫時還在", exposure: "human", price: 0.03, human: 2, reputation: 2, mind: 1 },
    { label: "當沒有這場演示", detail: "下一季還會再來", exposure: "cash", price: 0.03, mind: -2, human: -2, reputation: -1 },
  ]),
  road("clerk", "k_sign", "k_machine", 47, "要你簽一份你沒核過的帳", "年底。前面三個人都簽了。你的名字是最後一個空格。", [
    { label: "簽", detail: "今年收得了", exposure: "career", price: 0.05, reputation: -3, mind: -4 },
    { label: "不簽，把帳退回去", detail: "夜會很長", exposure: "human", price: 0.02, reputation: 4, mind: -1, social: -3 },
    { label: "只簽你核過的範圍", detail: "空格還在，但有一句", exposure: "diversify", price: 0.03, reputation: 2, mind: -2, human: 1 },
  ]),
  road("clerk", "k_list", "k_sign", 55, "裁員名單交到你手上", "不是建議。是要你填完。其中有教你這份工作的人。", [
    { label: "照成本填", detail: "表能交", exposure: "career", price: 0.05, reputation: -2, mind: -4, social: -3, human: 1 },
    { label: "把你不同意的名字拿掉，自己去解釋", detail: "名單會被退回", exposure: "human", price: 0.02, reputation: 3, mind: -1, social: 2 },
    { label: "辭掉這份，改自己接帳", detail: "名單不再經你的手", exposure: "venture", price: 0.04, mind: 2, human: 1, spendUsd: 800, career: "shop", jobUsd: 15000, setFlags: { founder: true } },
  ]),

  road("civil", "v_name", null, 26, "檔案上有一個你認識的名字", "照規矩，這件不該由你批。走廊上沒有人知道你們認識。", [
    { label: "交給別人，並寫明原因", detail: "規矩還在", exposure: "human", price: 0.02, reputation: 3, kin: -2, mind: 1 },
    { label: "自己批，當普通案子", detail: "速度快", exposure: "career", price: 0.04, reputation: -4, mind: -2, kin: 2 },
    { label: "擱下，等它過了你的手", detail: "誰也不欠", exposure: "cash", price: 0.03, reputation: -1, mind: -2, human: -1 },
  ]),
  road("civil", "v_wait", "v_name", 33, "上司要你把一份許可再壓一壓", "沒有寫成命令。喝茶的時候說的。申請人每個月都在問。", [
    { label: "照程序放行", detail: "上面會記得", exposure: "human", price: 0.02, reputation: 3, mind: 1, social: -2 },
    { label: "再壓一個月", detail: "茶還喝得成", exposure: "career", price: 0.04, reputation: -3, mind: -3, human: -1 },
    { label: "把這句話寫進備忘", detail: "以後不只是口說", exposure: "diversify", price: 0.03, reputation: 2, mind: -2, social: -1 },
  ]),
  road("civil", "v_rule", "v_wait", 40, "你要執行一項你認為會傷人的規定", "規定已經生效。你的名字會出現在執行的那一欄。", [
    { label: "照規定做完", detail: "職務內", exposure: "career", price: 0.04, reputation: 1, mind: -4, human: -1 },
    { label: "做到必須的那一截，其餘寫報告", detail: "慢，而且留了字", exposure: "human", price: 0.02, reputation: 2, mind: -1, human: 2 },
    { label: "公開說你不做", detail: "位子不一定還在", exposure: "venture", price: 0.02, reputation: 3, mind: 1, social: -2, human: -2 },
  ]),
  road("civil", "v_side", "v_rule", 48, "下一級要你先站邊", "兩個上司，兩套未來。不站的人，今年沒有名字。", [
    { label: "站你認為對的那邊", detail: "另一邊的門會關", exposure: "human", price: 0.03, reputation: 2, mind: -1, social: -2, human: 1 },
    { label: "站能讓你上去的那邊", detail: "位子近了", exposure: "career", price: 0.05, reputation: -2, mind: -3, human: 2, jobUsd: 28000 },
    { label: "哪邊都不站", detail: "這一年停在這裡", exposure: "cash", price: 0.02, mind: 2, reputation: 1, human: -2 },
  ]),
  road("civil", "v_hour", "v_side", 56, "出事的那個小時，手冊寫著先等", "外面已經在問。指示還沒有到。你等，或者你先動。", [
    { label: "先動，用你看得到的去做", detail: "指示來了再對", exposure: "human", price: 0.03, reputation: 3, mind: -1, human: 1, social: 1 },
    { label: "等指示", detail: "程序完整", exposure: "career", price: 0.04, reputation: -1, mind: -3, social: -2 },
    { label: "卸任這條線，去企業做你懂的那門", detail: "公門在身後", exposure: "venture", price: 0.04, mind: 1, human: 2, career: "clerk", jobUsd: 30000, setFlags: { civil: false } },
  ]),

  road("shop", "s_cash", null, 24, "供應商把回扣放在桌上", "不是發票上的折扣。是信封。接下，進貨價會好看。不接，貨不一定還優先給你。", [
    { label: "退回", detail: "價錢照單", exposure: "human", price: 0.02, reputation: 3, mind: 1, social: -1 },
    { label: "收下", detail: "這個月的貨穩", exposure: "career", price: 0.05, reputation: -4, mind: -2, gainUsd: 600 },
    { label: "改寫進合同，變成公開的條件", detail: "沒有信封", exposure: "diversify", price: 0.04, reputation: 1, human: 1, mind: 1 },
  ]),
  road("shop", "s_hand", "s_cash", 31, "櫃上少了東西，人也少了一餐", "你知道是誰。家裡還等這份工。報，或者自己補上。", [
    { label: "當面對質，讓他離開", detail: "帳回來，人走", exposure: "career", price: 0.03, reputation: 2, mind: -1, social: -2, kin: -1 },
    { label: "私下補上，給他一條還的路", detail: "店先不聲張", exposure: "human", price: 0.02, kin: 2, mind: 1, reputation: -1, spendUsd: 200 },
    { label: "裝沒有發現", detail: "明天還會少", exposure: "cash", price: 0.04, mind: -3, reputation: -2 },
  ]),
  road("shop", "s_lease", "s_hand", 38, "租金要加倍，約下個月到期", "這條街還是這條街。留下的算法變了。搬走，熟客不一定跟著。", [
    { label: "簽，把價錢轉進每一件貨", detail: "位子還在", exposure: "real", price: 0.04, mind: -2, human: 1, reputation: -1 },
    { label: "搬去便宜的地方", detail: "客人要重新認識門", exposure: "cash", price: 0.03, mind: -1, social: -2, human: 1, spendUsd: 900 },
    { label: "跟業主拆開談，用更長的約換回一截", detail: "你被綁久一點", exposure: "diversify", price: 0.03, mind: 1, human: 1, reputation: 1 },
  ]),
  road("shop", "s_offer", "s_lease", 46, "連鎖要用你的名字", "店還能開。名字掛到他們的招牌上。你可以留下當經理，或者拿走一筆離開。", [
    { label: "賣名，留下當他們的經理", detail: "店還在，不再是你的", exposure: "career", price: 0.05, mind: -2, reputation: -1, human: 1, gainUsd: 8000, career: "clerk", jobUsd: 22000, setFlags: { founder: false } },
    { label: "不賣", detail: "招牌還是原樣", exposure: "human", price: 0.03, mind: 2, reputation: 2, human: 1 },
    { label: "賣，然後離開這一行", detail: "錢進個人資金，路要重找", exposure: "cash", price: 0.04, mind: 1, gainUsd: 12000, career: "clerk", jobUsd: 18000, setFlags: { founder: false } },
  ]),
  road("shop", "s_book", "s_offer", 54, "合夥人要帳先好看一點", "不是沒有那筆生意。是它還沒發生。銀行下個月來看。", [
    { label: "只放已經發生的", detail: "見面會難談", exposure: "human", price: 0.02, reputation: 3, mind: -1, social: -1 },
    { label: "照他說的放", detail: "表能看", exposure: "leverage", price: 0.05, reputation: -4, mind: -3, leverage: 0.08 },
    { label: "把合夥拆開，帳各記各的", detail: "店會變小", exposure: "diversify", price: 0.03, mind: 1, reputation: 1, human: -1, social: -2 },
  ]),

  along("o_favor", null, 28, "有人把一張名字放到你桌上", "選舉已經過去。這個人出過力。他要的不是感謝，是一件正在你手上的事。", [
    { label: "照原來的規矩辦", detail: "人情在這一句斷", exposure: "human", price: 0.02, reputation: 3, social: -3, mind: -1 },
    { label: "幫這一次", detail: "下次還會有桌子", exposure: "career", price: 0.04, reputation: -3, mind: -2, social: 2 },
    { label: "把這張名字退回去，並告訴你的人", detail: "圈子會知道", exposure: "diversify", price: 0.03, reputation: 2, social: -2, mind: -1 },
  ], (life) => Boolean(life.flags.office)),
  along("o_vote", "o_favor", 36, "你答應過的一票，跟你現在看見的不一樣", "會還沒開。兩種算法都說得通。只有一種是你在外面說過的。", [
    { label: "照你答應的投", detail: "話還在", exposure: "human", price: 0.03, reputation: 2, mind: -2, social: 1 },
    { label: "照你現在看見的投", detail: "外面要解釋", exposure: "career", price: 0.03, reputation: 1, mind: 1, social: -3 },
    { label: "棄權", detail: "兩邊都記", exposure: "cash", price: 0.02, reputation: -2, mind: -1, social: -1 },
  ], (life) => Boolean(life.flags.office)),
  along("o_name", "o_vote", 46, "你的名字被寫進一件你沒有做完的事", "報導已經在排。辭，事情不一定停。留，名字繼續被用。", [
    { label: "留下，把沒做完的說完", detail: "還在任", exposure: "human", price: 0.03, reputation: 2, mind: -2, human: 1 },
    { label: "辭職", detail: "名字從位子上拿下", exposure: "cash", price: 0.02, reputation: 1, mind: 2, social: -1, setFlags: { office: false } },
    { label: "留下，先讓別人去說", detail: "時間可能不夠", exposure: "career", price: 0.04, reputation: -2, mind: -3 },
  ], (life) => Boolean(life.flags.office)),

  along("h_cut", null, 32, "董事要你裁掉你曾經做過的那種位子", "數字你看過。那些位子你年輕時坐過。主席的薪酬還是會進你的個人資金。", [
    { label: "照數字裁", detail: "表先活", exposure: "career", price: 0.05, reputation: -2, mind: -3, human: 1, social: -2 },
    { label: "裁別處，留下那些位子", detail: "你要另外找數字", exposure: "human", price: 0.02, reputation: 2, mind: 1, social: 2, human: -1 },
    { label: "把自己的薪酬先砍一截，再談名單", detail: "桌子會安靜一下", exposure: "diversify", price: 0.03, reputation: 3, mind: 1, kin: 1 },
  ], (life) => Boolean(life.chairman)),
  along("h_pay", "h_cut", 42, "你的薪酬，和公司帳上的現金", "兩邊都寫著你的名字。一邊是個人資金，一邊是還能不能發薪水給別人。", [
    { label: "薪酬照舊", detail: "合約就是合約", exposure: "career", price: 0.04, reputation: -2, mind: -1, social: -2 },
    { label: "減自己的，把現金留下", detail: "個人資金少一截", exposure: "human", price: 0.02, reputation: 3, mind: 1, social: 1 },
    { label: "薪酬換成之後再算", detail: "今年先過", exposure: "diversify", price: 0.03, reputation: 1, mind: -1, human: 1 },
  ], (life) => Boolean(life.chairman)),
  along("h_seat", "h_pay", 52, "有人要一張不該空出來的椅子", "是親戚，或者是出過錢的人。董事局等你點頭。", [
    { label: "拒絕", detail: "椅子照資格", exposure: "human", price: 0.02, reputation: 3, kin: -3, mind: -1 },
    { label: "給他", detail: "房間會比較靜", exposure: "real", price: 0.04, reputation: -3, kin: 2, mind: -2 },
    { label: "給一個沒有投票權的位子", detail: "人在，權不在", exposure: "diversify", price: 0.03, reputation: 1, kin: 1, mind: -1 },
  ], (life) => Boolean(life.chairman)),
];
