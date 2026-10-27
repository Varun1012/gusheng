export type ThemeId = "hall" | "bull" | "bear" | "night";

export interface MusicPrefs {
  music: boolean;
  sfx: boolean;
  /** 0–1 */
  volume: number;
  theme: ThemeId;
}

export const MUSIC_THEMES: { id: ThemeId; name: string }[] = [
  { id: "hall", name: "開市" },
  { id: "bull", name: "牛市" },
  { id: "bear", name: "熊市" },
  { id: "night", name: "夜盤" },
];

export const DEFAULT_MUSIC: MusicPrefs = {
  music: true,
  sfx: true,
  volume: 0.55,
  theme: "hall",
};

const STORAGE = "gusheng.music.v1";

interface ThemeDef {
  root: number;
  bpm: number;
  semis: number[];
  pattern: number[];
  fifth: number;
  cutoff: number;
  wave: OscillatorType;
}

const THEME: Record<ThemeId, ThemeDef> = {
  hall: {
    root: 220,
    bpm: 76,
    semis: [0, 2, 4, 7, 9, 12],
    pattern: [0, 2, 4, 2, 3, 2, 4, 1, 0, 2, 3, 4, 2, 1, 0, 4],
    fifth: 1.498,
    cutoff: 1400,
    wave: "triangle",
  },
  bull: {
    root: 261.63,
    bpm: 104,
    semis: [0, 2, 4, 7, 9, 12, 14, 16],
    pattern: [0, 2, 4, 5, 4, 2, 6, 7, 5, 4, 6, 7, 5, 3, 2, 0],
    fifth: 1.5,
    cutoff: 2200,
    wave: "triangle",
  },
  bear: {
    root: 164.81,
    bpm: 52,
    semis: [0, 1, 5, 7, 10, 12],
    pattern: [0, -1, 2, -1, 1, -1, 3, -1, 0, -1, 4, -1, 2, -1, 1, -1],
    fifth: 1.498,
    cutoff: 680,
    wave: "sine",
  },
  night: {
    root: 196,
    bpm: 64,
    semis: [0, 3, 5, 7, 10, 12, 15],
    pattern: [0, -1, 2, -1, -1, 4, -1, 3, -1, -1, 1, -1, 5, -1, -1, 0],
    fifth: 2,
    cutoff: 900,
    wave: "sine",
  },
};

let prefs: MusicPrefs = { ...DEFAULT_MUSIC };
let unlocked = false;
let duck = false;
let ctx: AudioContext | null = null;
let musicGain: GainNode | null = null;
let padA: OscillatorNode | null = null;
let padB: OscillatorNode | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let step = 0;
let nextTime = 0;

function isTheme(id: string): id is ThemeId {
  return id === "hall" || id === "bull" || id === "bear" || id === "night";
}

export function loadMusic(): MusicPrefs {
  if (typeof window === "undefined") return { ...DEFAULT_MUSIC };
  try {
    const raw = localStorage.getItem(STORAGE);
    if (!raw) return { ...DEFAULT_MUSIC };
    const parsed = JSON.parse(raw) as Partial<MusicPrefs>;
    return {
      music: parsed.music !== false,
      sfx: parsed.sfx !== false,
      volume: clampVol(parsed.volume),
      theme: parsed.theme && isTheme(parsed.theme) ? parsed.theme : "hall",
    };
  } catch {
    return { ...DEFAULT_MUSIC };
  }
}

function clampVol(n: unknown): number {
  const v = typeof n === "number" ? n : DEFAULT_MUSIC.volume;
  if (!Number.isFinite(v)) return DEFAULT_MUSIC.volume;
  return Math.min(1, Math.max(0, v));
}

function persist(next: MusicPrefs) {
  try {
    localStorage.setItem(STORAGE, JSON.stringify(next));
  } catch {
    /* private mode */
  }
}

function level(): number {
  if (!prefs.music) return 0.0001;
  const shaped = prefs.volume * prefs.volume * 0.2;
  return Math.max(0.0001, shaped * (duck ? 0.42 : 1));
}

function applyLevel(seconds = 0.12) {
  if (!ctx || !musicGain) return;
  const now = ctx.currentTime;
  musicGain.gain.cancelScheduledValues(now);
  musicGain.gain.setValueAtTime(Math.max(0.0001, musicGain.gain.value), now);
  musicGain.gain.exponentialRampToValueAtTime(level(), now + seconds);
}

function context(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  if (!ctx) {
    ctx = new Ctx();
    musicGain = ctx.createGain();
    musicGain.gain.value = 0.0001;
    musicGain.connect(ctx.destination);
    document.addEventListener("visibilitychange", () => {
      if (!ctx) return;
      if (document.hidden) void ctx.suspend();
      else if (prefs.music && unlocked) void ctx.resume();
    });
  }
  return ctx;
}

function ensurePads() {
  const audio = context();
  if (!audio || !musicGain || padA) return;
  const theme = THEME[prefs.theme];
  const filter = audio.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 420;
  const gain = audio.createGain();
  gain.gain.value = 0.55;
  padA = audio.createOscillator();
  padB = audio.createOscillator();
  padA.type = "sine";
  padB.type = "sine";
  padA.frequency.value = theme.root / 2;
  padB.frequency.value = (theme.root / 2) * theme.fifth;
  padA.connect(filter);
  padB.connect(filter);
  filter.connect(gain).connect(musicGain);
  padA.start();
  padB.start();
}

function retunePads() {
  if (!ctx || !padA || !padB) return;
  const theme = THEME[prefs.theme];
  const now = ctx.currentTime;
  padA.frequency.cancelScheduledValues(now);
  padB.frequency.cancelScheduledValues(now);
  padA.frequency.exponentialRampToValueAtTime(Math.max(40, theme.root / 2), now + 0.4);
  padB.frequency.exponentialRampToValueAtTime(Math.max(40, (theme.root / 2) * theme.fifth), now + 0.4);
}

function playTone(time: number, freq: number, dur: number, amp: number, wave: OscillatorType, cutoff: number) {
  if (!ctx || !musicGain) return;
  const osc = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  osc.type = wave;
  osc.frequency.setValueAtTime(freq, time);
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(cutoff, time);
  filter.frequency.exponentialRampToValueAtTime(Math.max(180, cutoff * 0.35), time + dur);
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(amp, time + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + dur);
  osc.connect(filter).connect(gain).connect(musicGain);
  osc.start(time);
  osc.stop(time + dur + 0.05);
}

function schedule(index: number, time: number) {
  const theme = THEME[prefs.theme];
  const degree = theme.pattern[index % theme.pattern.length] ?? -1;
  if (index % 8 === 0) {
    playTone(time, theme.root / 2, 0.9, 0.22, "sine", 500);
  }
  if (degree < 0) return;
  const semi = theme.semis[degree] ?? 0;
  const freq = theme.root * 2 ** (semi / 12);
  const busy = theme.pattern.filter((n) => n >= 0).length > 10;
  playTone(time, freq, busy ? 0.28 : 0.7, 0.34, theme.wave, theme.cutoff);
}

function tick() {
  if (!ctx || !prefs.music) return;
  const theme = THEME[prefs.theme];
  const horizon = ctx.currentTime + 0.22;
  const eighth = 60 / theme.bpm / 2;
  while (nextTime < horizon) {
    schedule(step, nextTime);
    nextTime += eighth;
    step = (step + 1) % 16;
  }
}

function startLoop() {
  const audio = context();
  if (!audio || !prefs.music) return;
  ensurePads();
  retunePads();
  applyLevel(0.2);
  void audio.resume();
  if (nextTime < audio.currentTime) nextTime = audio.currentTime + 0.06;
  if (!timer) timer = setInterval(tick, 25);
}

function stopLoop() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  applyLevel(0.2);
}

export function configureMusic(next: MusicPrefs) {
  prefs = {
    music: next.music,
    sfx: next.sfx,
    volume: clampVol(next.volume),
    theme: isTheme(next.theme) ? next.theme : "hall",
  };
  persist(prefs);
  if (!unlocked) return;
  if (prefs.music && prefs.volume > 0.001) startLoop();
  else stopLoop();
  retunePads();
}

export function unlockAudio() {
  unlocked = true;
  if (prefs.music && prefs.volume > 0.001) startLoop();
}

export function setDuck(on: boolean) {
  duck = on;
  if (unlocked) applyLevel(0.6);
}

function sfxContext(): AudioContext | null {
  if (!prefs.sfx && !prefs.music) return null;
  const audio = context();
  if (!audio) return null;
  unlocked = true;
  void audio.resume();
  return audio;
}

export function blip(up: boolean) {
  if (!prefs.sfx) return;
  const audio = sfxContext();
  if (!audio) return;
  const time = audio.currentTime + 0.02;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = "triangle";
  osc.frequency.value = up ? 540 : 180;
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(0.03, time + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.09);
  osc.connect(gain).connect(audio.destination);
  osc.start(time);
  osc.stop(time + 0.1);
}

export function toll() {
  if (!prefs.sfx && !prefs.music) return;
  const audio = sfxContext();
  if (!audio) return;
  const root = THEME[prefs.theme].root / 2;
  [0, 5, 12].forEach((semi, i) => {
    const time = audio.currentTime + 0.05 + i * 0.42;
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = "sine";
    osc.frequency.value = root * 2 ** (-semi / 12);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(0.05, time + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 1.1);
    osc.connect(gain).connect(audio.destination);
    osc.start(time);
    osc.stop(time + 1.15);
  });
}
