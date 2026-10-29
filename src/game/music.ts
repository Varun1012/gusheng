export type ThemeId = "day" | "low";

export interface MusicPrefs {
  music: boolean;
  sfx: boolean;
  /** 0–1 */
  volume: number;
  theme: ThemeId;
}

export const MUSIC_THEMES: { id: ThemeId; name: string }[] = [
  { id: "day", name: "日常" },
  { id: "low", name: "低潮" },
];

export const DEFAULT_MUSIC: MusicPrefs = {
  music: true,
  sfx: true,
  volume: 0.55,
  theme: "day",
};

const STORAGE = "gusheng.music.v1";

interface ThemeDef {
  root: number;
  bpm: number;
  semis: number[];
  pattern: number[];
  fifth: number;
  third: number;
  cutoff: number;
  wave: OscillatorType;
}

const THEME: Record<ThemeId, ThemeDef> = {
  day: {
    root: 246.94,
    bpm: 96,
    semis: [0, 2, 4, 7, 9, 12, 14, 16],
    pattern: [0, 2, 4, 7, 4, 2, 5, 4, 0, 3, 5, 7, 5, 2, 4, 0],
    fifth: 1.498,
    third: 1.26,
    cutoff: 2100,
    wave: "triangle",
  },
  low: {
    root: 164.81,
    bpm: 64,
    semis: [0, 3, 5, 7, 10, 12, 15],
    pattern: [0, 2, -1, 4, 1, -1, 3, 5, 0, -1, 2, 4, -1, 1, 3, 0],
    fifth: 1.498,
    third: 1.189,
    cutoff: 980,
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
let padC: OscillatorNode | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let step = 0;
let nextTime = 0;

function isTheme(id: string): id is ThemeId {
  return id === "day" || id === "low";
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
      theme: parsed.theme && isTheme(parsed.theme) ? parsed.theme : "day",
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
  filter.frequency.value = 520;
  const gain = audio.createGain();
  gain.gain.value = 0.42;
  padA = audio.createOscillator();
  padB = audio.createOscillator();
  padC = audio.createOscillator();
  padA.type = "sine";
  padB.type = "sine";
  padC.type = "triangle";
  padA.frequency.value = theme.root / 2;
  padB.frequency.value = (theme.root / 2) * theme.fifth;
  padC.frequency.value = (theme.root / 2) * theme.third;
  padA.connect(filter);
  padB.connect(filter);
  padC.connect(filter);
  filter.connect(gain).connect(musicGain);
  padA.start();
  padB.start();
  padC.start();
}

function retunePads() {
  if (!ctx || !padA || !padB || !padC) return;
  const theme = THEME[prefs.theme];
  const now = ctx.currentTime;
  padA.frequency.cancelScheduledValues(now);
  padB.frequency.cancelScheduledValues(now);
  padC.frequency.cancelScheduledValues(now);
  padA.frequency.exponentialRampToValueAtTime(Math.max(40, theme.root / 2), now + 0.4);
  padB.frequency.exponentialRampToValueAtTime(Math.max(40, (theme.root / 2) * theme.fifth), now + 0.4);
  padC.frequency.exponentialRampToValueAtTime(Math.max(40, (theme.root / 2) * theme.third), now + 0.45);
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
  const beat = index % 16;
  if (beat % 4 === 0) playTone(time, theme.root / 4, 0.46, 0.2, "sine", 280);
  if (beat % 8 === 0) {
    playTone(time, theme.root / 2, 1.05, 0.1, "sine", 760);
    playTone(time, (theme.root / 2) * theme.fifth, 1.05, 0.07, "triangle", 980);
    playTone(time, (theme.root / 2) * theme.third, 0.9, 0.05, "sine", 1200);
  }
  if (beat % 2 === 0) playTone(time, theme.root * 8, 0.04, 0.035, "square", 4200);
  const degree = theme.pattern[beat] ?? -1;
  if (degree >= 0) {
    const semi = theme.semis[degree] ?? 0;
    const freq = theme.root * 2 ** (semi / 12);
    playTone(time, freq, theme.bpm > 80 ? 0.28 : 0.55, 0.2, theme.wave, theme.cutoff);
    if (beat % 4 === 2) playTone(time, freq / theme.fifth, 0.42, 0.07, "triangle", theme.cutoff * 0.7);
  }
  if (beat === 12) playTone(time, theme.root * 2, 0.5, 0.045, "sine", 2400);
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
    theme: isTheme(next.theme) ? next.theme : "day",
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

export function verdictSound(ok: boolean) {
  if (!prefs.sfx) return;
  const audio = sfxContext();
  if (!audio) return;
  const now = audio.currentTime + 0.02;
  const notes = ok ? [523.25, 659.25, 783.99, 1046.5] : [349.23, 311.13, 246.94, 196];
  notes.forEach((freq, i) => {
    const time = now + i * (ok ? 0.08 : 0.12);
    const osc = audio.createOscillator();
    const filter = audio.createBiquadFilter();
    const gain = audio.createGain();
    osc.type = ok ? "triangle" : "sawtooth";
    osc.frequency.setValueAtTime(freq, time);
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(ok ? 2400 : 700, time);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(ok ? 0.07 : 0.05, time + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + (ok ? 0.28 : 0.42));
    osc.connect(filter).connect(gain).connect(audio.destination);
    osc.start(time);
    osc.stop(time + 0.5);
  });
}
