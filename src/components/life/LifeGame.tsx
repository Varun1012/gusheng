import { useEffect, useState } from "react";
import {
  Activity,
  FastForward,
  Globe,
  GraduationCap,
  HeartPulse,
  Landmark,
  Rocket,
  RotateCcw,
  Scale,
  ScrollText,
  Shield,
} from "lucide-react";
import { COUNTRIES, countryById } from "@/game/countries";
import {
  beginYear,
  createLife,
  currentChoices,
  currentEventCopy,
  choose,
  fastForward,
  previewMortality,
  runBalance,
  setPolicy,
} from "@/game/engine";
import {
  capMultiple,
  capUsd,
  epitaph,
  formatCompact,
  formatMultiple,
  formatPct,
  formatPrice,
  formatQ,
  priceMultiple,
  scoreOf,
} from "@/game/format";
import { tierLabel } from "@/game/names";
import { POLICIES, type Policy } from "@/game/policies";
import { regimeFor } from "@/game/regimes";
import { loadBoard, loadSnap, pushRecord, saveSnap, type RunRecord, type Snap } from "@/game/save";
import type { BirthInput, HistPoint, Life, PolicyId, Report } from "@/game/types";

declare global {
  interface Window {
    __gushengBalance?: (n: number) => unknown;
  }
}

type Phase = "title" | "pick" | "birth" | "play" | "dead" | "board";

const DECADES: { label: string; year: number | null }[] = [
  { label: "隨機年代", year: null },
  { label: "大蕭條", year: 1932 },
  { label: "戰火", year: 1939 },
  { label: "戰後", year: 1948 },
  { label: "黃金年代", year: 1958 },
  { label: "石油之前", year: 1969 },
  { label: "滯脹", year: 1976 },
  { label: "泡沫前", year: 1986 },
  { label: "千禧", year: 1996 },
  { label: "海嘯前", year: 2003 },
];

const POLICY_ICON: Record<PolicyId, typeof Shield> = {
  cash: Shield,
  leverage: Scale,
  human: GraduationCap,
  health: HeartPulse,
  diversify: Globe,
  venture: Rocket,
};

let audioCtx: AudioContext | null = null;

function blip(up: boolean) {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    audioCtx ??= new Ctx();
    if (audioCtx.state === "suspended") void audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "triangle";
    osc.frequency.value = up ? 540 : 180;
    gain.gain.setValueAtTime(0.028, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.08);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.09);
  } catch {
    /* autoplay locks are fine */
  }
}

function tone(n: number): string {
  if (n > 0.0008) return "text-up";
  if (n < -0.0008) return "text-down";
  return "text-muted";
}

function Spark({ points }: { points: HistPoint[] }) {
  if (points.length < 2) {
    return <div className="flex h-28 items-center text-sm text-muted">上市第一筆報價，曲線還沒有長度。</div>;
  }
  const values = points.map((p) => p.capUsd);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const w = 640;
  const h = 112;
  const coords = values.map((value, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - 8 - ((value - min) / span) * (h - 16);
    return [x, y] as const;
  });
  const line = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${w},${h} L0,${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-28 w-full" role="img" aria-label="市值曲線">
      <path d={area} fill="var(--color-gold)" opacity="0.16" />
      <path d={line} fill="none" stroke="var(--color-gold)" strokeWidth="2.5" />
    </svg>
  );
}

function Meter({ label, value }: { label: string; value: number }) {
  const width = `${Math.max(0, Math.min(100, value))}%`;
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-muted">
        <span>{label}</span>
        <span className="font-mono text-ivory">{Math.round(value)}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-line">
        <div className="h-full bg-gold" style={{ width }} />
      </div>
    </div>
  );
}

function PolicyPicker({
  active,
  onPick,
}: {
  active: PolicyId;
  onPick: (id: PolicyId) => void;
}) {
  return (
    <div className="flex min-w-0 gap-2 overflow-x-auto pb-1">
      {POLICIES.map((policy) => (
        <PolicyChip key={policy.id} policy={policy} active={active === policy.id} onPick={onPick} />
      ))}
    </div>
  );
}

function PolicyChip({
  policy,
  active,
  onPick,
}: {
  policy: Policy;
  active: boolean;
  onPick: (id: PolicyId) => void;
}) {
  const Icon = POLICY_ICON[policy.id];
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={() => onPick(policy.id)}
      className={
        "min-h-11 shrink-0 rounded-xl border px-3 py-2 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold " +
        (active ? "border-gold bg-gold text-ink" : "border-line bg-panel-2 text-ivory hover:border-gold")
      }
    >
      <span className="flex items-center gap-2 text-sm font-medium">
        <Icon className="size-4" aria-hidden="true" />
        {policy.name}
      </span>
      <span className={"mt-0.5 block text-xs " + (active ? "text-ink/80" : "text-muted")}>{policy.blurb}</span>
    </button>
  );
}

export function LifeGame() {
  const [phase, setPhase] = useState<Phase>("title");
  const [life, setLife] = useState<Life | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [board, setBoard] = useState<RunRecord[]>([]);
  const [saved, setSaved] = useState<Snap | null>(null);
  const [decade, setDecade] = useState<number | null>(null);
  const [sound, setSound] = useState(true);
  const [returnTo, setReturnTo] = useState<Phase>("title");
  const [showLog, setShowLog] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setBoard(loadBoard());
    setSaved(loadSnap());
    setReady(true);
    window.__gushengBalance = runBalance;
  }, []);

  useEffect(() => {
    if (!ready || !life) return;
    if (phase === "birth" || phase === "play" || phase === "dead") {
      saveSnap({ phase, life, reports });
    }
  }, [ready, phase, life, reports]);

  function born(input: BirthInput) {
    const created = createLife(input);
    setLife(created);
    setReports([]);
    setShowLog(false);
    setPhase("birth");
  }

  function settle(next: Life, nextReports: Report[]) {
    let recorded = next;
    if (!next.alive && !next.recorded) {
      const epi = epitaph(next);
      const row: RunRecord = {
        name: next.name,
        ticker: next.ticker,
        countryId: next.countryId,
        birthYear: next.birthYear,
        age: next.age,
        score: epi.score,
        grade: epi.grade,
        capUsd: capUsd(next),
        capMult: capMultiple(next),
        priceMult: priceMultiple(next),
        cause: next.cause ?? "未知",
        at: Date.now(),
      };
      setBoard(pushRecord(row));
      recorded = { ...next, recorded: true };
    }
    setLife(recorded);
    setReports(nextReports);
    setPhase(recorded.alive ? "play" : "dead");
    const last = nextReports[nextReports.length - 1];
    if (sound && last) blip(!last.died && last.pricePct >= 0);
  }

  function act(index: number | null) {
    if (!life?.plan) return;
    const step = choose(life, index);
    settle(step.life, [step.report]);
  }

  function skipQuiet() {
    if (!life) return;
    const step = fastForward(life);
    if (step.reports.length === 0) return;
    settle(step.life, step.reports);
  }

  const market = life ? countryById(life.countryId) : null;

  return (
    <main className="min-h-screen overflow-x-hidden bg-ink text-ivory">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-5 sm:px-6 sm:py-8">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <button type="button" onClick={() => setPhase("title")} className="text-left">
            <p className="font-serif text-2xl font-semibold tracking-wide text-gold">股生</p>
            <p className="text-xs tracking-[0.22em] text-muted">BORN LISTED</p>
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSound((v) => !v)}
              className="min-h-11 rounded-xl border border-line px-3 text-sm text-muted"
            >
              {sound ? "聲音開" : "聲音關"}
            </button>
            <button
              type="button"
              onClick={() => {
                setReturnTo(phase === "board" ? "title" : phase);
                setPhase("board");
              }}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line px-3 text-sm"
            >
              <ScrollText className="size-4 text-gold" aria-hidden="true" />
              歷代收盤
            </button>
          </div>
        </header>

        {phase === "title" && (
          <Title
            saved={saved}
            onRandom={() => born({})}
            onPick={() => setPhase("pick")}
            onResume={() => {
              if (!saved) return;
              setLife(saved.life);
              setReports(saved.reports ?? []);
              setPhase(saved.phase);
            }}
          />
        )}

        {phase === "pick" && (
          <Pick
            decade={decade}
            onDecade={setDecade}
            onBack={() => setPhase("title")}
            onChoose={(countryId) => {
              const year =
                decade === null ? undefined : decade + Math.floor(Math.random() * 5) - 2;
              born({ countryId, birthYear: year });
            }}
          />
        )}

        {phase === "birth" && life && market && (
          <Birth
            life={life}
            onPolicy={(id) => setLife(setPolicy(life, id))}
            onStart={() => {
              setLife(beginYear(life));
              setPhase("play");
            }}
          />
        )}

        {phase === "play" && life && market && life.plan && (
          <Play
            life={life}
            reports={reports}
            showLog={showLog}
            onToggleLog={() => setShowLog((v) => !v)}
            onPolicy={(id) => setLife(setPolicy(life, id))}
            onChoose={(index) => act(index)}
            onYear={() => act(null)}
            onSkip={skipQuiet}
          />
        )}

        {phase === "dead" && life && market && (
          <Dead
            life={life}
            showLog={showLog}
            onToggleLog={() => setShowLog((v) => !v)}
            onAgain={() => born({})}
            onRerun={() =>
              born({
                seed: life.seed,
                countryId: life.origin.countryId,
                birthYear: life.origin.birthYear,
              })
            }
          />
        )}

        {phase === "board" && <Board rows={board} onBack={() => setPhase(returnTo)} />}
      </div>
    </main>
  );
}

function Title({
  saved,
  onRandom,
  onPick,
  onResume,
}: {
  saved: Snap | null;
  onRandom: () => void;
  onPick: () => void;
  onResume: () => void;
}) {
  return (
    <section className="grid gap-6 lg:grid-cols-5">
      <div className="lg:col-span-3">
        <p className="text-sm text-gold">每個人降生時已經掛牌</p>
        <h1 className="mt-2 font-serif text-5xl font-semibold leading-tight sm:text-6xl">
          把這一生
          <br />
          做成一隻股票
        </h1>
        <div className="mt-5 max-w-xl space-y-3 text-base leading-relaxed text-muted">
          <p>你可以赤貧，也可以含著金湯匙。目標只有一個：除牌之前，把股價與市值一起做到最大。</p>
          <p>途中的選擇取材自全球市場的牛熊。同一件事，在泡沫、滯脹、海嘯裡，結果可以相反。你能做的，是換上對的人生政策。</p>
          <p>死亡不由劇情赦免。每年按當地、該曆年、該年齡的死亡率擲一次骰，健康與「健康優先」會改這個數。</p>
        </div>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={onRandom}
            className="min-h-11 rounded-xl bg-gold px-5 py-3 font-medium text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
          >
            隨機投胎
          </button>
          <button
            type="button"
            onClick={onPick}
            className="min-h-11 rounded-xl border border-line px-5 py-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
          >
            自選市場
          </button>
          {saved && (
            <button type="button" onClick={onResume} className="min-h-11 rounded-xl border border-line px-5 py-3 text-gold">
              繼續這一世
            </button>
          )}
        </div>
        <p className="mt-4 text-xs text-muted">紅漲、綠跌。紀錄只留在這部裝置。</p>
      </div>
      <aside className="flex flex-col justify-between rounded-2xl border border-line bg-panel p-5 lg:col-span-2">
        <div>
          <Landmark className="size-6 text-gold" aria-hidden="true" />
          <p className="mt-4 font-serif text-xl">招股說明</p>
          <ul className="mt-3 space-y-2 text-sm leading-relaxed text-muted">
            <li>出身決定開盤價與市值，國家決定匯率、波動與壽命。</li>
            <li>六種基本政策隨時可換，用來對付不同的經濟時期。</li>
            <li>抉擇上會寫明曝險。時期係數可以把同一選擇從賺錢變成虧錢。</li>
            <li>增發會做大市值、做薄股價。兩個都要大，才算真的上市成功。</li>
          </ul>
        </div>
        <p className="mt-6 font-mono text-xs text-gold">IPO OF A LIFE</p>
      </aside>
    </section>
  );
}

function Pick({
  decade,
  onDecade,
  onBack,
  onChoose,
}: {
  decade: number | null;
  onDecade: (year: number | null) => void;
  onBack: () => void;
  onChoose: (countryId: string) => void;
}) {
  return (
    <section>
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-serif text-3xl">選擇上市地</h1>
        <button type="button" onClick={onBack} className="min-h-11 text-sm text-muted">
          返回
        </button>
      </div>
      <div className="mt-4 flex min-w-0 gap-2 overflow-x-auto pb-1">
        {DECADES.map((item) => {
          const on = decade === item.year;
          return (
            <button
              key={item.label}
              type="button"
              aria-pressed={on}
              onClick={() => onDecade(item.year)}
              className={
                "min-h-11 shrink-0 rounded-full border px-3 text-sm " +
                (on ? "border-gold bg-gold text-ink" : "border-line text-ivory")
              }
            >
              {item.label}
            </button>
          );
        })}
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {COUNTRIES.map((country) => (
          <button
            key={country.id}
            type="button"
            onClick={() => onChoose(country.id)}
            className="min-h-11 rounded-2xl border border-line bg-panel p-4 text-left transition hover:border-gold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
          >
            <span className="flex items-baseline justify-between gap-3">
              <span className="font-serif text-xl">{country.name}</span>
              <span className="font-mono text-xs text-gold">{country.ccy}</span>
            </span>
            <span className="mt-1 block text-sm text-muted">{country.exchange}</span>
            <span className="mt-3 flex justify-between text-xs text-muted">
              <span>2000年前後出生，約 {country.e0} 歲</span>
              <span>{country.skew}</span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

function Birth({
  life,
  onPolicy,
  onStart,
}: {
  life: Life;
  onPolicy: (id: PolicyId) => void;
  onStart: () => void;
}) {
  const market = countryById(life.countryId);
  const regime = regimeFor(life.birthYear, life.countryId);
  const q = previewMortality(life);
  return (
    <section className="grid gap-4 lg:grid-cols-5">
      <div className="rounded-2xl border border-line bg-panel p-5 lg:col-span-3">
        <p className="text-xs tracking-[0.2em] text-gold">招股書</p>
        <h1 className="mt-2 font-serif text-4xl">{life.name}</h1>
        <p className="mt-1 font-mono text-lg text-gold">{life.ticker}</p>
        <p className="mt-3 text-sm text-muted">
          {market.exchange} · {life.birthYear}年 · {tierLabel(life.tier)}
        </p>
        <p className="mt-2 text-sm leading-relaxed">{life.family}</p>
        <p className="mt-3 text-sm text-muted">
          出生那年：{regime.name}。{regime.headline}
        </p>
        <dl className="mt-6 grid grid-cols-2 gap-4">
          <Stat k="開盤價" v={`${formatPrice(life.price)} ${market.ccy}`} />
          <Stat k="開盤市值" v={`${formatCompact(life.price * life.shares)} ${market.ccy}`} />
          <Stat k="約合美元" v={`USD ${formatCompact(life.ipoCapUsd)}`} />
          <Stat k="流通股" v={formatCompact(life.shares)} />
        </dl>
      </div>
      <div className="flex flex-col gap-4 lg:col-span-2">
        <button
          type="button"
          onClick={onStart}
          className="min-h-11 rounded-xl bg-gold px-5 py-3 font-medium text-ink"
        >
          開始計價
        </button>
        <div className="rounded-2xl border border-line bg-panel p-5">
          <p className="text-sm text-muted">出生當年存活檢定</p>
          <p className="mt-1 font-mono text-3xl">{formatQ(q)}</p>
          <p className="mt-2 text-xs leading-relaxed text-muted">
            死亡率依{market.name}、{life.birthYear}年、0歲估算。越早的年份越高。進入市場後才擲骰。
          </p>
          <div className="mt-4 space-y-3">
            <Meter label="健康" value={life.health} />
            <Meter label="人力" value={life.human} />
            <Meter label="名聲" value={life.reputation} />
          </div>
        </div>
        <div>
          <p className="mb-2 text-sm text-muted">基本政策，可以隨時換</p>
          <PolicyPicker active={life.policy} onPick={onPolicy} />
        </div>
      </div>
    </section>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-xs text-muted">{k}</dt>
      <dd className="mt-1 font-mono text-xl text-ivory">{v}</dd>
    </div>
  );
}

function Play({
  life,
  reports,
  showLog,
  onToggleLog,
  onPolicy,
  onChoose,
  onYear,
  onSkip,
}: {
  life: Life;
  reports: Report[];
  showLog: boolean;
  onToggleLog: () => void;
  onPolicy: (id: PolicyId) => void;
  onChoose: (index: number) => void;
  onYear: () => void;
  onSkip: () => void;
}) {
  const market = countryById(life.countryId);
  const plan = life.plan!;
  const event = currentEventCopy(life);
  const choices = currentChoices(life);
  const cap = life.price * life.shares;
  const last = reports[reports.length - 1];
  const quietRun =
    reports.length > 1
      ? reports.reduce((acc, report) => acc * (1 + report.capPct), 1) - 1
      : null;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-sm text-gold">{life.ticker}</p>
          <h1 className="font-serif text-2xl">{life.name}</h1>
          <p className="text-sm text-muted">
            {life.age}歲 · {plan.year}年 · {market.name}
          </p>
        </div>
        <p className="max-w-xl text-sm leading-relaxed text-muted">
          <span className="mr-2 inline-block rounded-full border border-line px-2 py-0.5 text-ivory">{plan.regimeName}</span>
          {plan.headline}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="rounded-2xl border border-line bg-panel p-5 lg:col-span-3">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted">股價</p>
              <p className="font-mono text-3xl sm:text-4xl">{formatPrice(life.price)}</p>
              <p className="text-xs text-muted">{market.ccy}</p>
              <p className={"mt-1 font-mono text-sm " + tone(priceMultiple(life) - 1)}>
                自上市 {formatMultiple(priceMultiple(life))}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted">市值</p>
              <p className="font-mono text-3xl sm:text-4xl">{formatCompact(cap)}</p>
              <p className="text-xs text-muted">{market.ccy}</p>
              <p className={"mt-1 font-mono text-sm " + tone(capMultiple(life) - 1)}>
                自上市 {formatMultiple(capMultiple(life))} · USD {formatCompact(capUsd(life))}
              </p>
            </div>
          </div>
          <div className="mt-4">
            <Spark points={life.history} />
            <p className="text-xs text-muted">曲線是美元市值，轉板不會造成假跳空。</p>
          </div>
        </div>
        <div className="rounded-2xl border border-line bg-panel p-5 lg:col-span-2">
          <div className="flex items-center gap-2 text-sm text-muted">
            <Activity className="size-4 text-gold" aria-hidden="true" />
            本年存活檢定
          </div>
          <p className={"mt-1 font-mono text-3xl " + (plan.q > 0.02 ? "text-up" : "text-ivory")}>
            {formatQ(plan.q)}
          </p>
          <p className="mt-1 text-xs text-muted">
            死亡率，不是存活率。推進這一年之後才揭曉擲骰。槓桿 {Math.round(life.leverage * 100)}%。
          </p>
          <div className="mt-4 space-y-3">
            <Meter label="健康" value={life.health} />
            <Meter label="人力" value={life.human} />
            <Meter label="名聲" value={life.reputation} />
          </div>
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm text-muted">基本政策</p>
        <PolicyPicker active={life.policy} onPick={onPolicy} />
      </div>

      {event ? (
        <div className="rounded-2xl border border-gold/50 bg-panel p-5">
          <p className="text-xs text-gold">抉擇 · {life.age}歲</p>
          <h2 className="mt-1 font-serif text-2xl">{event.title}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted">{event.body}</p>
          <div className="mt-4 grid gap-2">
            {choices.map((choice, index) => (
              <button
                key={choice.label}
                type="button"
                onClick={() => onChoose(index)}
                className="min-h-11 rounded-xl border border-line bg-panel-2 px-4 py-3 text-left transition hover:border-gold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
              >
                <span className="block text-sm font-medium">
                  {index + 1}. {choice.label}
                </span>
                <span className="mt-1 block text-xs text-muted">{choice.detail}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-line bg-panel p-5">
          <h2 className="font-serif text-2xl">沒有人叫你做決定</h2>
          <p className="mt-2 text-sm text-muted">{plan.headline}</p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <button type="button" onClick={onYear} className="min-h-11 rounded-xl bg-gold px-4 py-3 font-medium text-ink">
              過這一年
            </button>
            <button
              type="button"
              onClick={onSkip}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-line px-4 py-3"
            >
              <FastForward className="size-4" aria-hidden="true" />
              快進到下一個抉擇
            </button>
          </div>
        </div>
      )}

      {last && (
        <div className="rounded-2xl border border-line px-4 py-3 text-sm leading-relaxed">
          <p className="font-medium">
            {last.year} · {last.title}
            <span className={"ml-2 font-mono " + tone(last.pricePct)}>股價 {formatPct(last.pricePct)}</span>
            <span className={"ml-2 font-mono " + tone(last.capPct)}>市值 {formatPct(last.capPct)}</span>
          </p>
          {quietRun !== null && (
            <p className="text-muted">這段安靜年份，市值合計 {formatPct(quietRun)}。</p>
          )}
          <p className="text-muted">{last.explanation}</p>
        </div>
      )}

      <button type="button" onClick={onToggleLog} className="self-start text-sm text-gold">
        {showLog ? "收起年表" : "展開年表"}
      </button>
      {showLog && <Log life={life} />}
    </section>
  );
}

function Log({ life }: { life: Life }) {
  const rows = [...life.log].reverse();
  return (
    <ol className="max-h-80 space-y-3 overflow-auto rounded-2xl border border-line p-4">
      {rows.map((line, index) => (
        <li key={`${line.year}-${index}`} className="text-sm">
          <p className="font-mono text-xs text-gold">
            {line.year} · {line.age}歲
          </p>
          <p className="font-medium">{line.title}</p>
          <p className="text-muted">{line.detail}</p>
        </li>
      ))}
    </ol>
  );
}

function Dead({
  life,
  showLog,
  onToggleLog,
  onAgain,
  onRerun,
}: {
  life: Life;
  showLog: boolean;
  onToggleLog: () => void;
  onAgain: () => void;
  onRerun: () => void;
}) {
  const market = countryById(life.countryId);
  const epi = epitaph(life);
  const cap = life.price * life.shares;
  return (
    <section className="grid gap-4 lg:grid-cols-5">
      <div className="lg:col-span-3">
        <div className="seal text-2xl">除牌</div>
        <h1 className="mt-6 font-serif text-4xl">{epi.title}</h1>
        <p className="mt-2 text-sm text-gold">
          {epi.grade} · 綜合 {epi.score}
        </p>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-muted">{epi.text}</p>
        <p className="mt-4 text-sm">
          {life.name} · {life.ticker}
          <br />
          {life.birthYear}–{life.deathYear ?? life.birthYear + life.age} · 享年 {life.age} 歲 · {market.name}
          <br />
          死因：{life.cause ?? "未知"}
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <button type="button" onClick={onAgain} className="min-h-11 rounded-xl bg-gold px-4 py-3 font-medium text-ink">
            再投胎
          </button>
          <button
            type="button"
            onClick={onRerun}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-line px-4 py-3"
          >
            <RotateCcw className="size-4" aria-hidden="true" />
            同一顆種子
          </button>
          <button type="button" onClick={onToggleLog} className="min-h-11 rounded-xl border border-line px-4 py-3">
            {showLog ? "收起年表" : "這世年表"}
          </button>
        </div>
        {showLog && (
          <div className="mt-4">
            <Log life={life} />
          </div>
        )}
      </div>
      <dl className="grid content-start gap-4 rounded-2xl border border-line bg-panel p-5 lg:col-span-2">
        <Stat k="終值股價" v={`${formatPrice(life.price)} ${market.ccy}`} />
        <Stat k="股價倍數" v={formatMultiple(priceMultiple(life))} />
        <Stat k="終值市值" v={`${formatCompact(cap)} ${market.ccy}`} />
        <Stat k="市值倍數" v={formatMultiple(capMultiple(life))} />
        <Stat k="美元終值" v={`USD ${formatCompact(capUsd(life))}`} />
        <Stat k="峰值市值" v={`USD ${formatCompact(life.peakCapUsd)}`} />
        <p className="text-xs leading-relaxed text-muted">
          分數同時看美元市值、相對開盤的倍數，以及你活了多久。出身很重，但把一隻仙股做成成長股，仍然算數。
        </p>
      </dl>
    </section>
  );
}

function Board({ rows, onBack }: { rows: RunRecord[]; onBack: () => void }) {
  return (
    <section>
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-3xl">歷代收盤</h1>
        <button type="button" onClick={onBack} className="min-h-11 text-sm text-muted">
          返回
        </button>
      </div>
      {rows.length === 0 ? (
        <p className="mt-6 text-muted">還沒有除牌的人生。去敲一次鐘。</p>
      ) : (
        <ol className="mt-4 divide-y divide-line rounded-2xl border border-line">
          {rows.map((row) => (
            <li key={row.at} className="grid gap-1 px-4 py-3 sm:grid-cols-6 sm:items-center">
              <span className="sm:col-span-2">
                <span className="block font-medium">{row.name}</span>
                <span className="font-mono text-xs text-gold">{row.ticker}</span>
              </span>
              <span className="text-sm text-muted">
                {countryById(row.countryId).name} · {row.age}歲
              </span>
              <span className="font-mono text-sm">USD {formatCompact(row.capUsd)}</span>
              <span className="font-mono text-sm">{formatMultiple(row.capMult)}</span>
              <span className="text-sm">
                {row.grade}
                <span className="ml-2 font-mono text-gold">{row.score}</span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
