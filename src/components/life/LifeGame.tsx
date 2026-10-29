import { useEffect, useRef, useState } from "react";
import {
  Activity,
  Globe,
  GraduationCap,
  HeartPulse,
  Landmark,
  Music,
  Rocket,
  RotateCcw,
  Scale,
  ScrollText,
  Shield,
} from "lucide-react";
import { CAREER_LABEL } from "@/game/career-events";
import { COUNTRIES, birthOdds, countryById } from "@/game/countries";
import {
  beginYear,
  createLife,
  currentChoices,
  currentEventCopy,
  acceptChoice,
  advance,
  buyHome,
  chairCost,
  choiceMoney,
  choose,
  debtRoom,
  dimensions,
  previewMortality,
  runBalance,
  satisfaction,
  sellHome,
  setPolicy,
  spend,
  takeChair,
  quotedHome,
} from "@/game/engine";
import {
  capMultiple,
  capUsd,
  epitaph,
  formatCompact,
  formatMoney,
  formatMultiple,
  formatPct,
  formatPrice,
  formatQ,
  priceMultiple,
  scoreOf,
} from "@/game/format";
import { PriceAgeChart } from "@/components/life/PriceChart";
import {
  MUSIC_THEMES,
  blip,
  configureMusic,
  loadMusic,
  setDuck,
  toll,
  unlockAudio,
  verdictSound,
  DEFAULT_MUSIC,
  type MusicPrefs,
} from "@/game/music";
import { tierLabel } from "@/game/names";
import { POLICIES, type Policy } from "@/game/policies";
import { REGIME_NAME, cycleBlurb } from "@/game/regimes";
import { policyMood, SPENDS, investChance, spendOpen, spendVisible, workLabel } from "@/game/spends";
import { loadBoard, loadSnap, pushRecord, saveSnap, type RunRecord, type Snap } from "@/game/save";
import type { BirthInput, HistPoint, Life, PolicyId, Report } from "@/game/types";
import type { Dimensions } from "@/game/engine";

declare global {
  interface Window {
    __gushengBalance?: (n: number) => unknown;
  }
}

type Phase = "title" | "pick" | "arrive" | "birth" | "play" | "dead" | "board";

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

function tone(n: number): string {
  if (n > 0.0008) return "text-up";
  if (n < -0.0008) return "text-down";
  return "text-muted";
}

function shiftRows(before: Dimensions, after: Dimensions) {
  return (
    [
      ["生理", after.body - before.body],
      ["心理", after.mind - before.mind],
      ["成就", after.achieve - before.achieve],
      ["精神", after.spirit - before.spirit],
    ] as const
  ).map(([name, delta]) => ({ name, delta: Math.round(delta) }));
}

type Verdict = {
  ok: boolean;
  label: string;
  detail: string;
  shifts: { name: string; delta: number }[];
  next: Life;
  report: Report | null;
};

const FACET_NAME: Record<string, string> = {
  mind: "心理",
  body: "身體",
  kin: "家庭",
  social: "社會",
  money: "開支",
  work: "生計",
};

function Spark({ points }: { points: HistPoint[] }) {
  if (points.length < 2) {
    return <div className="flex h-28 items-center text-sm text-muted">上市第一筆報價，曲線還沒有長度。</div>;
  }
  const values = points.map((p) => p.priceUsd ?? p.price);
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
    <svg viewBox={`0 0 ${w} ${h}`} className="h-28 w-full" role="img" aria-label="股價曲線">
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

function PolicyPicker({ active, onPick }: { active: PolicyId; onPick: (id: PolicyId) => void }) {
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
  const [music, setMusic] = useState<MusicPrefs>(DEFAULT_MUSIC);
  const [musicOpen, setMusicOpen] = useState(false);
  const [returnTo, setReturnTo] = useState<Phase>("title");
  const [showLog, setShowLog] = useState(false);
  const [ready, setReady] = useState(false);
  const [quoting, setQuoting] = useState(true);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const tolled = useRef<string | null>(null);

  useEffect(() => {
    setBoard(loadBoard());
    setSaved(loadSnap());
    const loaded = loadMusic();
    setMusic(loaded);
    configureMusic(loaded);
    setReady(true);
    window.__gushengBalance = runBalance;
  }, []);

  useEffect(() => {
    if (!musicOpen) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setMusicOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [musicOpen]);

  useEffect(() => {
    setDuck(phase === "dead");
  }, [phase]);

  useEffect(() => {
    if (phase !== "dead" || !life) return;
    const key = `${life.ticker}-${life.birthYear}-${life.age}`;
    if (tolled.current === key) return;
    tolled.current = key;
    toll();
  }, [phase, life]);

  useEffect(() => {
    if (!ready || !life) return;
    if (phase === "birth" || phase === "play" || phase === "dead") {
      saveSnap({ phase, life, reports });
    }
  }, [ready, phase, life, reports]);

  function born(input: BirthInput) {
    unlockAudio();
    const created = createLife(input);
    setLife(created);
    setReports([]);
    setShowLog(false);
    setQuoting(true);
    setPhase(input.countryId ? "birth" : "arrive");
  }

  function settle(next: Life, report: Report) {
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
    setReports((prev) => [...prev, report].slice(-6));
    setPhase(recorded.alive ? "play" : "dead");
    if (music.sfx && (report.died || recorded.plan?.eventId)) blip(!report.died && report.pricePct >= 0);
  }

  function act(index: number) {
    if (!life?.plan || verdict) return;
    unlockAudio();
    const before = dimensions(life);
    const label = currentChoices(life)[index]?.label ?? "";
    const step = acceptChoice(life, index);
    const after = dimensions(step.life);
    const shifts = shiftRows(before, after);
    const detail = step.report?.detail || step.life.plan?.detail || "";
    const ok = shifts.reduce((sum, row) => sum + row.delta, 0) > 0;
    verdictSound(ok);
    setQuoting(false);
    setVerdict({ ok, label, detail, shifts, next: step.life, report: step.report });
  }

  function dismissVerdict() {
    if (!verdict) return;
    const held = verdict;
    setVerdict(null);
    if (held.report) settle(held.next, held.report);
    else setLife(held.next);
    setQuoting(true);
  }

  function finishYear() {
    if (!life?.alive || !life.plan) return;
    if (life.plan.eventId && !life.plan.committed) return;
    const step = choose(life, null);
    if (step.report) settle(step.life, step.report);
    else {
      setLife(step.life);
      if (music.sfx && step.life.plan?.eventId && !step.life.plan.committed) blip(true);
    }
  }

  useEffect(() => {
    if (!ready || phase !== "play" || !quoting || !life?.alive || !life.plan) return;
    if (life.plan.eventId && !life.plan.committed) return;
    const timer = window.setTimeout(() => {
      const step = advance(life);
      if (step.life === life) return;
      if (step.report) settle(step.life, step.report);
      else {
        setLife(step.life);
        if (music.sfx && step.life.plan?.eventId && !step.life.plan.committed) blip(true);
      }
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [ready, phase, quoting, life, music.sfx]);

  const market = life ? countryById(life.countryId) : null;

  return (
    <main className="min-h-screen overflow-x-hidden bg-ink text-ivory">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-5 sm:px-6 sm:py-8">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <button type="button" onClick={() => setPhase("title")} className="text-left">
            <p className="text-xs tracking-[0.22em] text-gold">股生</p>
            <p className="font-serif text-2xl font-semibold">
              {life && phase !== "title" && phase !== "pick" && phase !== "board" ? life.name : "把這一生上市"}
            </p>
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-expanded={musicOpen}
              onClick={() => {
                unlockAudio();
                setMusicOpen((open) => !open);
              }}
              className={
                "inline-flex min-h-11 items-center gap-2 rounded-xl border px-3 text-sm " +
                (music.music ? "border-gold text-ivory" : "border-line text-muted")
              }
            >
              <Music className="size-4 text-gold" aria-hidden="true" />
              {music.music ? MUSIC_THEMES.find((theme) => theme.id === music.theme)?.name : "靜音"}
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

        {musicOpen && (
          <MusicPanel
            prefs={music}
            onClose={() => setMusicOpen(false)}
            onChange={(next) => {
              setMusic(next);
              configureMusic(next);
              unlockAudio();
            }}
          />
        )}

        {phase === "title" && (
          <Title
            saved={saved}
            onRandom={() => born({})}
            onPick={() => setPhase("pick")}
            onResume={() => {
              if (!saved) return;
              unlockAudio();
              const resumed = saved.life.alive && (!saved.life.plan || saved.life.plan.slotMode !== "cell")
                ? beginYear({ ...saved.life, plan: null })
                : saved.life;
              setLife(resumed);
              setReports(saved.reports ?? []);
              setQuoting(true);
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

        {phase === "arrive" && life && (
          <Arrive life={life} onDone={() => setPhase("birth")} />
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
            onSpend={(id) => {
              const before = life.price;
              const next = spend(life, id);
              if (next === life) return;
              setLife(next);
              if (music.sfx) blip(next.price >= before);
            }}
            onChair={() => {
              const before = life.price;
              const next = takeChair(life);
              if (next === life) return;
              setLife(next);
              if (music.sfx) blip(next.price >= before);
            }}
            onBuyHome={(mode) => {
              const before = life.price;
              const next = buyHome(life, mode);
              if (next === life) return;
              setLife(next);
              if (music.sfx) blip(next.price >= before);
            }}
            onSellHome={() => {
              const before = life.price;
              const next = sellHome(life);
              if (next === life) return;
              setLife(next);
              if (music.sfx) blip(next.price >= before);
            }}
            quoting={quoting}
            onToggleQuote={() => setQuoting((v) => !v)}
            onFinishYear={finishYear}
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
        {phase === "play" && life?.plan?.eventId && !life.plan.committed && (
          <ChoiceDialog life={life} onChoose={act} />
        )}
        {verdict && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/80 px-4">
            <div className="max-h-[90vh] w-full max-w-md overflow-auto rounded-2xl border border-line bg-panel p-6">
              <p className="font-serif text-3xl text-ivory">這一選</p>
              {verdict.label ? <p className="mt-2 text-sm text-muted">{verdict.label}</p> : null}
              <ul className="mt-5 space-y-2">
                {verdict.shifts.map((row) => (
                  <li key={row.name} className="flex items-center justify-between gap-3 text-sm">
                    <span>{row.name}</span>
                    <span className="font-mono text-ivory">
                      {row.delta > 0 ? `升 ${row.delta}` : row.delta < 0 ? `降 ${Math.abs(row.delta)}` : "沒有動"}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-sm text-muted">{verdict.ok ? "四個向度合起來往上。" : "四個向度合起來沒有往上。"}</p>
              {verdict.detail && verdict.detail !== verdict.label ? (
                <p className="mt-4 text-sm leading-relaxed text-muted">{verdict.detail}</p>
              ) : null}
              <button
                type="button"
                autoFocus
                onClick={dismissVerdict}
                className="mt-5 min-h-11 w-full rounded-xl bg-gold px-4 py-3 font-medium text-ink"
              >
                {verdict.next.alive ? "繼續" : "看除牌"}
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function MusicPanel({
  prefs,
  onChange,
  onClose,
}: {
  prefs: MusicPrefs;
  onChange: (next: MusicPrefs) => void;
  onClose: () => void;
}) {
  return (
    <div className="rounded-2xl border border-line bg-panel p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="font-serif text-lg">音樂設定</p>
        <button type="button" onClick={onClose} className="min-h-11 px-2 text-sm text-muted">
          收起
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {MUSIC_THEMES.map((theme) => {
          const on = prefs.theme === theme.id;
          return (
            <button
              key={theme.id}
              type="button"
              aria-pressed={on}
              onClick={() => onChange({ ...prefs, theme: theme.id, music: true })}
              className={
                "min-h-11 rounded-xl border px-4 text-sm " +
                (on ? "border-gold bg-gold text-ink" : "border-line bg-panel-2 text-ivory")
              }
            >
              {theme.name}
            </button>
          );
        })}
      </div>
      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end">
        <label className="block min-w-0 flex-1 text-sm">
          <span className="flex items-center justify-between text-muted">
            音量
            <span className="font-mono text-ivory">{Math.round(prefs.volume * 100)}</span>
          </span>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(prefs.volume * 100)}
            aria-valuetext={`${Math.round(prefs.volume * 100)}%`}
            onChange={(event) => onChange({ ...prefs, volume: Number(event.target.value) / 100, music: true })}
            className="mt-2 w-full accent-gold"
          />
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            aria-pressed={prefs.music}
            onClick={() => onChange({ ...prefs, music: !prefs.music })}
            className={
              "min-h-11 rounded-xl border px-4 text-sm " +
              (prefs.music ? "border-gold text-ivory" : "border-line text-muted")
            }
          >
            {prefs.music ? "音樂開" : "音樂關"}
          </button>
          <button
            type="button"
            aria-pressed={prefs.sfx}
            onClick={() => onChange({ ...prefs, sfx: !prefs.sfx })}
            className={
              "min-h-11 rounded-xl border px-4 text-sm " +
              (prefs.sfx ? "border-gold text-ivory" : "border-line text-muted")
            }
          >
            {prefs.sfx ? "音效開" : "音效關"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Person({ id, className }: { id: string; className?: string }) {
  return (
    <img
      src={`${import.meta.env.BASE_URL}people/${id}.png`}
      alt=""
      draggable={false}
      className={"pixel object-contain " + (className ?? "h-40 w-24")}
    />
  );
}

function Arrive({ life, onDone }: { life: Life; onDone: () => void }) {
  const odds = birthOdds();
  const steps = 18;
  const [step, setStep] = useState(0);
  const [reduce, setReduce] = useState(false);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    setReduce(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  useEffect(() => {
    if (reduce || step >= steps) {
      const timer = window.setTimeout(() => doneRef.current(), reduce ? 700 : 1200);
      return () => window.clearTimeout(timer);
    }
    const delay = step < 11 ? 75 : 70 + (step - 10) * 48;
    const timer = window.setTimeout(() => setStep((n) => n + 1), delay);
    return () => window.clearTimeout(timer);
  }, [reduce, step]);

  const locked = reduce || step >= steps;
  const shown = locked ? countryById(life.countryId) : COUNTRIES[(step * 3) % COUNTRIES.length]!;
  const row = odds.find((item) => item.id === shown.id);

  return (
    <section className="grid gap-6 lg:grid-cols-5">
      <div className="lg:col-span-3">
        <p className="text-sm text-gold">投胎</p>
        <h1 className="mt-2 font-serif text-4xl sm:text-5xl">{locked ? shown.name : "戶籍還沒蓋章"}</h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">
          二十個上市地，按 2024 年粗出生率加權。出生率越高，越容易投到那裡。不是按人口。
        </p>
        <div className="mt-6 flex items-end gap-5">
          <Person id={shown.id} className="h-52 w-32" />
          <div>
            <p className="font-serif text-3xl">{shown.name}</p>
            <p className="mt-1 text-sm text-muted">{shown.exchange}</p>
            <p className="mt-3 font-mono text-gold">
              出生率 {row ? row.rate.toFixed(1) : "—"}‰
            </p>
            <p className="font-mono text-sm text-ivory">
              機率 {row ? (row.p * 100).toFixed(1) : "—"}%
            </p>
          </div>
        </div>
      </div>
      <ol className="max-h-80 space-y-2 overflow-auto rounded-2xl border border-line bg-panel p-4 lg:col-span-2">
        {odds
          .slice()
          .sort((a, b) => b.p - a.p)
          .map((item) => {
            const country = countryById(item.id);
            const on = item.id === shown.id;
            const maxP = odds.reduce((max, row) => Math.max(max, row.p), 0.01);
            return (
              <li key={item.id} className="flex items-center gap-3">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
                  <div
                    className={"h-full " + (on ? "bg-gold" : "bg-muted")}
                    style={{ width: `${(item.p / maxP) * 100}%` }}
                  />
                </div>
                <span className={"w-20 text-sm " + (on ? "text-gold" : "text-muted")}>{country.name}</span>
                <span className="w-12 text-right font-mono text-xs text-ivory">{(item.p * 100).toFixed(1)}%</span>
              </li>
            );
          })}
      </ol>
    </section>
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
          <p>你可以赤貧，也可以含著金湯匙。目標只有一個：除牌之前，把股價做上去。</p>
          <p>滿足度來自四個向度：生理、心理、成就、精神。市場冷暖只是背景，不跟真實年份對時。</p>
          <p>死亡不由劇情赦免。這一年的死亡率拆進十格裡擲，健康與政策會改這個數。每一格都自己計一次股價。</p>
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
            <li>出身決定開盤價，國家決定匯率、波動與壽命。</li>
            <li>六種基本政策隨時可換。換一套，四個向度會跟著偏，滿足度也跟著偏。</li>
            <li>滿足度來自生理、心理、成就、精神。股價跟著滿足度走，也跟著這一世自己的市道。市道不照真實年份排。</li>
            <li>家裡的人有名字。配偶若結成、孩子若有了，都會列出來，並寫明在世還是離世。</li>
            <li>重大抉擇一年一兩次，也可以一次都沒有。選項不限兩項，也不分對錯。視窗會直接彈出。選完看四個向度怎麼動。合起來往上，聲音是一種；沒有往上，是另一種。</li>
            <li>題目跟著已經走上的仕途往下問，同一件事不會再問。路可以在中途換。</li>
            <li>興趣同時只專注一門，但可以換。走路、投票、去公園不用錢。自己參選要付選舉開支。</li>
            <li>個人資金跟股票分開。職業收入和投資其他公司才進自己口袋，進帳先還負債。主席薪酬要先買回股票。</li>
            <li>負債年利率一成。不夠的差額記成負債，最多一萬美元。滾到五萬美元，這一世結束。</li>
            <li>一年十格，每秒走一格。沒有抉擇就繼續報價。落在哪一格不固定。</li>
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
  const cycleId = life.cycle?.id ?? "expansion";
  const q = previewMortality(life);
  return (
    <section className="grid gap-4 lg:grid-cols-5">
      <div className="rounded-2xl border border-line bg-panel p-5 lg:col-span-3">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs tracking-[0.2em] text-gold">招股書</p>
            <h1 className="mt-2 font-serif text-4xl">{life.name}</h1>
            <p className="mt-1 font-mono text-lg text-gold">{life.ticker}</p>
          </div>
          <Person id={life.countryId} className="h-40 w-24" />
        </div>
        <p className="mt-3 text-sm text-muted">
          {market.exchange} · {life.birthYear}年 · {tierLabel(life.tier)}
        </p>
        <p className="mt-2 text-sm leading-relaxed">{life.family}</p>
        <div className="mt-3">
          <FamilyBoard life={life} story={false} />
        </div>
        <p className="mt-3 text-sm text-muted">
          出生那年的市道：{REGIME_NAME[cycleId]}。{cycleBlurb(cycleId, life.seed + life.birthYear)}
        </p>
        <p className="mt-2 text-sm text-ivory">
          {life.name} 出生時個人資金是 0。父母會養。股價跟著這個人的滿足度走，不跟著一份自動發下來的薪酬。
        </p>
        <dl className="mt-6 grid grid-cols-2 gap-4">
          <Stat k="開盤價" v={`${formatPrice(life.price)} ${market.ccy}`} />
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
            <Meter label="生理" value={dimensions(life).body} />
            <Meter label="心理" value={dimensions(life).mind} />
            <Meter label="成就" value={dimensions(life).achieve} />
            <Meter label="精神" value={dimensions(life).spirit} />
          </div>
          <p className="mt-3 text-xs leading-relaxed text-muted">{policyMood(life.policy)}</p>
          {life.statusNote ? <p className="mt-1 text-sm text-ivory">{life.statusNote}</p> : null}
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

function SpendColumn({
  life,
  fx,
  onSpend,
  onChair,
  onBuyHome,
  onSellHome,
}: {
  life: Life;
  fx: number;
  onSpend: (id: string) => void;
  onChair: () => void;
  onBuyHome: (mode: "cash" | "mortgage") => void;
  onSellHome: () => void;
}) {
  const hobbies = SPENDS.filter((item) => item.group === "hobby" && spendVisible(item, life.age));
  const jobs = SPENDS.filter((item) => item.group === "work" && spendVisible(item, life.age));
  const investments = SPENDS.filter((item) => item.group === "invest" && spendVisible(item, life.age));
  const doing = workLabel(life.work);
  const hobby = life.hobby ? SPENDS.find((item) => item.id === life.hobby) : undefined;
  const ccy = countryById(life.countryId).ccy;
  const home = quotedHome(life);
  const down = home * 0.3;
  const equity = Math.max(0, (life.homeValue ?? 0) - (life.homeDebt ?? 0));
  const year = life.plan?.year ?? life.birthYear + life.age;
  const traded = (life.houseYear ?? 0) === year;
  const chair = life.age >= 18 ? chairCost(life) : 0;
  return (
    <div className="rounded-2xl border border-line bg-panel p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-serif text-2xl">個人花錢</h2>
        <p className="text-xs text-muted">
          {hobby ? `正在專注：${hobby.label}` : "還沒選定興趣"}
          {doing ? ` · 正在做的：${doing}` : ""}
          {life.career ? ` · 仕途：${CAREER_LABEL[life.career] ?? life.career}` : ""}
        </p>
      </div>
      <p className="mt-2 text-sm text-ivory">
        {life.statusNote || "興趣同時只專注一門，想換就換。"}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-muted">
        零工和投資其他公司，每一格一筆。錢不夠會記成負債。負債最多一萬美元，年利率一成。
      </p>
      {hobbies.length === 0 && jobs.length === 0 && investments.length === 0 ? (
        <p className="mt-4 text-sm text-muted">還小，興趣要再大一點。</p>
      ) : (
        <>
          {hobbies.length > 0 && (
            <SpendRow title="興趣 · 專注一門，可以換" items={hobbies} life={life} fx={fx} ccy={ccy} onSpend={onSpend} />
          )}
          {investments.length > 0 && (
            <SpendRow title="投資其他公司" items={investments} life={life} fx={fx} ccy={ccy} onSpend={onSpend} />
          )}
          {jobs.length > 0 && <SpendRow title="零工" items={jobs} life={life} fx={fx} ccy={ccy} onSpend={onSpend} />}
        </>
      )}
      {life.age >= 20 && (
        <div className="mt-4">
          <p className="text-xs text-muted">房子</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {life.flags.home ? (
              <button
                type="button"
                disabled={traded}
                onClick={onSellHome}
                className={
                  "min-h-11 rounded-xl border px-3 py-2 text-left text-sm " +
                  (traded ? "cursor-not-allowed border-line opacity-40" : "border-gold bg-gold/15 text-ivory")
                }
              >
                <span className="block">賣掉房子</span>
                <span className="block text-xs text-muted">
                  {equity > 1 ? `進帳 ${formatMoney(equity)} ${ccy}` : "賣了沒有進帳"}
                  {(life.debt ?? 0) > 1 && equity > 1 ? " · 先還負債" : ""}
                  {traded ? " · 今年已買賣過" : ""}
                </span>
              </button>
            ) : (
              <>
                <HouseButton
                  label="付三成買樓"
                  sub={
                    life.purse + debtRoom(life) + 0.5 < down
                      ? `扣 ${formatMoney(down)} ${ccy} · 超過負債上限`
                      : `扣 ${formatMoney(down)} ${ccy}${life.purse + 0.5 < down ? " · 不夠記成負債" : ""}`
                  }
                  disabled={traded}
                  onClick={() => onBuyHome("mortgage")}
                />
                <HouseButton
                  label="一次過付清"
                  sub={
                    life.purse + debtRoom(life) + 0.5 < home
                      ? `扣 ${formatMoney(home)} ${ccy} · 超過負債上限`
                      : `扣 ${formatMoney(home)} ${ccy}${life.purse + 0.5 < home ? " · 不夠記成負債" : ""}`
                  }
                  disabled={traded}
                  onClick={() => onBuyHome("cash")}
                />
              </>
            )}
          </div>
          {life.flags.home && (life.homeDebt ?? 0) > 1 && (
            <p className="mt-2 text-xs text-muted">還欠按揭 {formatMoney(life.homeDebt ?? 0)} {ccy}，每年再供一筆。</p>
          )}
        </div>
      )}
      {life.age >= 18 && (
        <div className="mt-4">
          <p className="text-xs text-muted">主席</p>
          <div className="mt-2">
            {life.chairman ? (
              <p className="text-sm text-ivory">你是主席。薪酬 {formatMoney(life.salary)} {ccy} 入個人資金。</p>
            ) : (
              <HouseButton
                label="買回股票，出任主席"
                sub={
                  life.purse + debtRoom(life) + 0.5 < chair
                    ? `扣 ${formatMoney(chair)} ${ccy} · 超過負債上限`
                    : `扣 ${formatMoney(chair)} ${ccy}${life.purse + 0.5 < chair ? " · 不夠記成負債" : ""}`
                }
                disabled={false}
                onClick={onChair}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function HouseButton({
  label,
  sub,
  disabled,
  onClick,
}: {
  label: string;
  sub: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={
        "min-h-11 rounded-xl border px-3 py-2 text-left text-sm " +
        (disabled ? "cursor-not-allowed border-line opacity-40" : "border-line bg-panel-2 text-ivory hover:border-gold")
      }
    >
      <span className="block">{label}</span>
      <span className="block text-xs text-muted">{sub}</span>
    </button>
  );
}

function SpendRow({
  title,
  items,
  life,
  fx,
  ccy,
  onSpend,
}: {
  title: string;
  items: typeof SPENDS;
  life: Life;
  fx: number;
  ccy: string;
  onSpend: (id: string) => void;
}) {
  return (
    <div className="mt-4">
      <p className="text-xs text-muted">{title}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {items.map((item) => {
          const open = spendOpen(item, life, fx);
          const hobbyOn = item.group === "hobby" && life.hobby === item.id;
          const workOn = Boolean(item.work && life.work === item.work);
          const cost = item.usd * fx;
          const chance = item.invest ? Math.round(investChance(life, item.invest.lean) * 100) : null;
          const over = cost > 0.5 && life.purse + debtRoom(life) + 0.5 < cost;
          const short = !over && cost > 0.5 && life.purse + 0.5 < cost;
          const sub = hobbyOn
            ? "正在專注"
            : item.usd <= 0
              ? "不用錢"
              : chance !== null
                ? `扣 ${formatMoney(cost)} ${ccy} · 成算 ${chance}%${over ? " · 超過負債上限" : short ? " · 不夠記成負債" : ""}`
                : `扣 ${formatMoney(cost)} ${ccy}${over ? " · 超過負債上限" : short ? " · 不夠記成負債" : ""}`;
          return (
            <button
              key={item.id}
              type="button"
              disabled={!open}
              onClick={() => onSpend(item.id)}
              className={
                "min-h-11 rounded-xl border px-3 py-2 text-left text-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold " +
                (hobbyOn || workOn ? "border-gold bg-gold/15 text-ivory " : "border-line bg-panel-2 text-ivory ") +
                (open ? "hover:border-gold" : "cursor-not-allowed opacity-40")
              }
            >
              <span className="block">{item.label}</span>
              <span className={"block text-xs " + (hobbyOn ? "text-gold" : "text-muted")}>{sub}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function choiceCaption(life: Life, choice: ReturnType<typeof currentChoices>[number], ccy: string): string {
  const moneyLine = choiceMoney(life, choice);
  const wage = (choice.jobUsd ?? 0) * countryById(life.countryId).fx;
  const over = moneyLine.cost > 0.5 && (life.purse ?? 0) + debtRoom(life) + 0.5 < moneyLine.cost;
  const short = !over && moneyLine.cost > 0.5 && (life.purse ?? 0) + 0.5 < moneyLine.cost;
  if (moneyLine.cost > 0) {
    return `扣 ${formatMoney(moneyLine.cost)} ${ccy}${over ? " · 超過負債上限" : short ? " · 不夠記成負債" : ""}`;
  }
  if (moneyLine.gain > 0) {
    return `進帳 ${formatMoney(moneyLine.gain)} ${ccy}${(life.debt ?? 0) > 1 ? " · 先還負債" : ""}`;
  }
  if (wage > 0) return `職業每年 ${formatMoney(wage)} ${ccy}`;
  return "";
}

function ChoiceDialog({ life, onChoose }: { life: Life; onChoose: (index: number) => void }) {
  const market = countryById(life.countryId);
  const event = currentEventCopy(life);
  const choices = currentChoices(life);
  const first = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    first.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  if (!event || choices.length === 0) return null;

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-ink/80 px-4 py-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="choice-title"
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-2xl border border-gold/50 bg-panel px-5 py-5 sm:px-6">
        <p className="text-xs text-gold">
          {event.facet ? `重大抉擇 · ${FACET_NAME[event.facet]}` : "重大抉擇"} · {life.age}歲 · 這一刻
        </p>
        <h2 id="choice-title" className="mt-1 font-serif text-2xl">
          {event.title}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">{event.body}</p>
        <div className="mt-4 grid gap-2">
          {choices.map((choice, index) => {
            const caption = choiceCaption(life, choice, market.ccy);
            return (
              <button
                key={choice.label}
                type="button"
                ref={index === 0 ? first : undefined}
                onClick={() => onChoose(index)}
                className="min-h-14 rounded-xl border border-line bg-panel-2 px-4 py-3 text-left transition hover:border-gold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
              >
                <span className="block text-base font-medium">{choice.label}</span>
                {caption ? <span className="mt-1 block text-xs text-muted">{caption}</span> : null}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Play({
  life,
  reports,
  showLog,
  onToggleLog,
  onPolicy,
  onSpend,
  onChair,
  onBuyHome,
  onSellHome,
  quoting,
  onToggleQuote,
  onFinishYear,
}: {
  life: Life;
  reports: Report[];
  showLog: boolean;
  onToggleLog: () => void;
  onPolicy: (id: PolicyId) => void;
  onSpend: (id: string) => void;
  onChair: () => void;
  onBuyHome: (mode: "cash" | "mortgage") => void;
  onSellHome: () => void;
  quoting: boolean;
  onToggleQuote: () => void;
  onFinishYear: () => void;
}) {
  const market = countryById(life.countryId);
  const plan = life.plan!;
  const event = currentEventCopy(life);
  const dims = dimensions(life);
  const last = reports[reports.length - 1];

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-end gap-4">
          <Person id={life.countryId} className="h-24 w-16" />
          <div>
            <p className="font-mono text-sm text-gold">{life.ticker}</p>
            <h1 className="font-serif text-3xl">{life.name}</h1>
            <p className="text-sm text-muted">
              {life.age}歲{life.flags.office ? " · 在任" : ""} · {plan.year}年 ·{" "}
              {plan.eventId && !plan.committed && plan.pendingSlot
                ? `第 ${plan.pendingSlot} 格要抉擇`
                : `第 ${life.slot}/10 格`}{" "}
              · {market.name}
            </p>
            <div className="mt-2 flex w-full min-w-48 max-w-xs gap-1" aria-label="本年十格，每秒一格">
              {Array.from({ length: 10 }, (_, i) => {
                const pending = plan.eventId && !plan.committed ? plan.pendingSlot : null;
                const cls = i < life.slot ? "bg-gold" : pending === i + 1 ? "bg-gold/40" : "bg-line";
                return <div key={i} className={"h-1.5 flex-1 rounded-sm " + cls} />;
              })}
            </div>
          </div>
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
              <p className="text-xs text-muted">個人資金</p>
              <p className="font-mono text-3xl sm:text-4xl">{(life.purse ?? 0) > 0 ? formatCompact(life.purse) : "0"}</p>
              <p className="text-xs text-muted">{market.ccy}</p>
              {(life.debt ?? 0) > 1 && (
                <p className="mt-1 font-mono text-sm text-ivory">負債 {formatMoney(life.debt ?? 0)} {market.ccy}</p>
              )}
              <p className="mt-1 text-xs text-muted">年利率一成 · 記成負債上限一萬美元</p>
              <p className="mt-1 text-sm text-muted">
                {life.chairman
                  ? `主席薪酬 ${formatCompact(life.salary)} 入個人資金`
                  : (life.job ?? 0) > 0
                    ? `職業收入 ${formatCompact(life.job ?? 0)}${(life.side ?? 0) > 0 ? " · 另有零工" : ""}。股票薪酬不入帳`
                    : (life.side ?? 0) > 0
                      ? "零工進個人資金。股票薪酬不入帳"
                      : life.age < 18
                        ? "父母供養。個人資金跟股票分開"
                        : "沒有職業收入。買回股票才有主席薪酬"}
              </p>
            </div>
          </div>
          <div className="mt-4">
            <Spark points={life.history} />
            <p className="text-xs text-muted">曲線是美元股價，每一格一個點。轉板不會造成假跳空。</p>
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
            這一年的死亡率，拆開在十格裡擲。槓桿 {Math.round(life.leverage * 100)}%。
          </p>
          <div className="mt-4 space-y-3">
            <Meter label="滿足度" value={satisfaction(life)} />
            <Meter label="生理" value={dims.body} />
            <Meter label="心理" value={dims.mind} />
            <Meter label="成就" value={dims.achieve} />
            <Meter label="精神" value={dims.spirit} />
          </div>
          <p className="mt-3 text-xs leading-relaxed text-muted">
            滿足度來自這四個向度。股價跟著滿足度走，也跟著這一世自己的市道。
          </p>
        </div>
      </div>

      <FamilyBoard life={life} />

      <div>
        <p className="mb-2 text-sm text-muted">基本政策</p>
        <PolicyPicker active={life.policy} onPick={onPolicy} />
        <p className="mt-2 text-xs leading-relaxed text-muted">{policyMood(life.policy)}</p>
      </div>

      <SpendColumn
        life={life}
        fx={market.fx}
        onSpend={onSpend}
        onChair={onChair}
        onBuyHome={onBuyHome}
        onSellHome={onSellHome}
      />

      {event ? (
        <div className="rounded-2xl border border-line bg-panel p-5">
          <h2 className="font-serif text-2xl">要做個選擇</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">視窗已經彈出。選完，這一格才會過去。</p>
          {(plan.recent ?? []).length > 0 && (
            <ul className="mt-3 space-y-1">
              {(plan.recent ?? []).map((line, index, all) => (
                <li key={`${line}-${index}`} className={index === all.length - 1 ? "text-sm text-ivory" : "text-sm text-muted"}>
                  {line}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-line bg-panel p-5">
          <h2 className="font-serif text-2xl">{quoting ? "報價進行中" : "報價暫停"}</h2>
          {(plan.recent ?? []).length > 0 && (
            <ul className="mt-2 space-y-1">
              {(plan.recent ?? []).map((line, index, all) => (
                <li key={`${line}-${index}`} className={index === all.length - 1 ? "text-sm text-ivory" : "text-sm text-muted"}>
                  {line}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-sm text-muted">{plan.headline}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onToggleQuote}
              className="min-h-11 rounded-xl border border-line px-4 py-3"
            >
              {quoting ? "暫停報價" : "繼續報價"}
            </button>
            <button type="button" onClick={onFinishYear} className="min-h-11 rounded-xl border border-line px-4 py-3">
              本年收市
            </button>
          </div>
        </div>
      )}

      {last && (
        <div className="rounded-2xl border border-line px-4 py-3 text-sm leading-relaxed">
          <p className="font-medium">
            {last.year} · {last.title}
            <span className={"ml-2 font-mono " + tone(last.pricePct)}>股價 {formatPct(last.pricePct)}</span>
            {last.payNote ? <span className="ml-2 text-ivory">{last.payNote}</span> : null}
          </p>
        </div>
      )}

      <button type="button" onClick={onToggleLog} className="self-start text-sm text-gold">
        {showLog ? "收起年表" : "展開年表"}
      </button>
      {showLog && <Log life={life} />}
    </section>
  );
}

function FamilyBoard({ life, story = true }: { life: Life; story?: boolean }) {
  const year = life.deathYear ?? life.plan?.year ?? life.birthYear + life.age;
  const order = { father: 0, mother: 1, sibling: 2, spouse: 3, child: 4 };
  const people = [...(life.household ?? [])].sort((a, b) => order[a.role] - order[b.role] || a.born - b.born);
  if (people.length === 0) return null;
  const living = people.filter((person) => person.alive).length;
  return (
    <div className="rounded-2xl border border-line bg-panel p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm text-muted">家庭</p>
        <p className="text-xs text-muted">
          在世 {living} · 離世 {people.length - living}
        </p>
      </div>
      {story && life.family ? <p className="mt-1 text-sm leading-relaxed">{life.family}</p> : null}
      <ul className="mt-1 divide-y divide-line">
        {people.map((person, index) => {
          const age = person.alive ? year - person.born : (person.died ?? year) - person.born;
          const ageText = age <= 0 ? "未滿一歲" : person.alive ? `${age}歲` : `享年 ${age}`;
          const state = !person.alive ? "離世" : person.apart ? "分開 · 在世" : "在世";
          return (
            <li key={`${person.role}-${person.name}-${person.born}-${index}`} className="flex items-baseline justify-between gap-3 py-2">
              <span className="min-w-0">
                <span className="text-sm text-ivory">
                  {person.tag} · {person.name}
                </span>
                <span className="mt-0.5 block text-xs text-muted">{person.note}</span>
              </span>
              <span className={"shrink-0 text-xs " + (person.alive && !person.apart ? "text-gold" : "text-muted")}>
                {state} · {ageText}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
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
  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="seal text-2xl">除牌</div>
          <h1 className="mt-4 font-serif text-4xl">{epi.title}</h1>
          <p className="mt-2 text-sm text-gold">
            {epi.grade} · 綜合 {epi.score}
          </p>
          <p className="mt-3 text-sm">
            {life.name} · {life.ticker}
            <br />
            {life.birthYear}–{life.deathYear ?? life.birthYear + life.age} · 享年 {life.age} 歲 · {market.name}
          </p>
        </div>
        <Person id={life.countryId} className="h-36 w-24" />
      </div>
      <div className="rounded-2xl border border-line bg-panel p-4 sm:p-5">
        <div className="mb-1 flex flex-wrap items-end justify-between gap-2">
          <h2 className="font-serif text-2xl">股價以年齡</h2>
          <p className="font-mono text-xs text-muted">每一格一點 · {life.history.length} 格 · 美元</p>
        </div>
        <PriceAgeChart points={life.history} />
      </div>
      <div className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <p className="max-w-xl text-base leading-relaxed text-muted">{epi.text}</p>
          <p className="mt-3 text-sm">死因：{life.cause ?? "未知"}</p>
          <div className="mt-4">
            <FamilyBoard life={life} />
          </div>
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
          <Stat k="享年" v={`${life.age} 歲`} />
          {(life.debt ?? 0) > 1 && <Stat k="負債" v={`${formatMoney(life.debt ?? 0)} ${market.ccy}`} />}
          <p className="text-xs leading-relaxed text-muted">
            分數看你活了多久，以及股價相對開盤走了多遠。
          </p>
        </dl>
      </div>
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
              <span className="font-mono text-sm">股價 {formatMultiple(row.priceMult)}</span>
              <span className="text-sm text-muted">{row.cause}</span>
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
