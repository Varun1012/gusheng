import { useEffect, useMemo, useRef, useState } from "react";
import { formatMultiple, formatPrice } from "@/game/format";
import type { HistPoint } from "@/game/types";

interface Print {
  i: number;
  age: number;
  year: number;
  usd: number;
}

function usdOf(point: HistPoint): number {
  if (point.priceUsd && point.priceUsd > 0) return point.priceUsd;
  if (point.cap > 0 && point.capUsd > 0) return (point.price * point.capUsd) / point.cap;
  return Math.max(point.price, 0.01);
}

function printsOf(points: HistPoint[]): Print[] {
  return points
    .map((point, i) => ({ i, age: point.age, year: point.year, usd: usdOf(point) }))
    .filter((point) => Number.isFinite(point.usd) && point.usd > 0);
}

function axisPrice(n: number): string {
  if (n >= 1000) {
    if (n >= 1e6) return `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M`;
    return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  }
  if (n >= 100) return n.toFixed(0);
  if (n >= 10) return n.toFixed(1);
  if (n >= 1) return n.toFixed(2);
  return n.toFixed(2);
}

export function PriceAgeChart({ points }: { points: HistPoint[] }) {
  const data = useMemo(() => printsOf(points), [points]);
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [active, setActive] = useState<number | null>(null);
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    setReduce(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const measure = () => setWidth(Math.max(280, el.clientWidth));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  if (data.length < 2) {
    return <p className="py-8 text-sm text-muted">這一生只有開盤一筆，曲線還沒有長度。</p>;
  }

  const height = width < 520 ? 248 : 300;
  const padL = 52;
  const padR = 12;
  const padT = 16;
  const padB = 28;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  const first = data[0]!;
  const last = data[data.length - 1]!;
  let peakAt = 0;
  data.forEach((point, index) => {
    if (point.usd > data[peakAt]!.usd) peakAt = index;
  });
  const peak = data[peakAt]!;
  const minV = Math.min(...data.map((point) => point.usd));
  const maxV = Math.max(...data.map((point) => point.usd));
  const log = maxV / minV >= 4;
  const lo = log ? Math.log(minV) : minV;
  const hi = log ? Math.log(maxV) : maxV;
  const span = hi - lo || 1;
  const yPad = span * 0.08;
  const yLo = lo - yPad;
  const yHi = hi + yPad;

  function yOf(value: number): number {
    const v = log ? Math.log(value) : value;
    return padT + (1 - (v - yLo) / (yHi - yLo)) * innerH;
  }

  function xOf(index: number): number {
    return padL + (index / (data.length - 1)) * innerW;
  }

  const coords = data.map((point, index) => [xOf(index), yOf(point.usd)] as const);
  const line = coords.map(([x, y], index) => `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const floorY = padT + innerH;
  const area = `${line} L${coords[coords.length - 1]![0].toFixed(1)},${floorY} L${coords[0]![0].toFixed(1)},${floorY} Z`;
  const up = last.usd >= first.usd;
  const stroke = up ? "var(--color-up)" : "var(--color-down)";
  const shownIndex = active ?? data.length - 1;
  const shown = data[shownIndex]!;
  const multiple = shown.usd / first.usd;

  const yTicks = log
    ? logTicks(minV, maxV)
    : [0, 1, 2, 3].map((i) => minV + ((maxV - minV) * i) / 3);
  const maxAge = last.age;
  const ageStep = maxAge <= 30 ? 10 : maxAge <= 80 ? 20 : 25;
  const ageTicks: number[] = [];
  for (let age = 0; age <= maxAge; age += ageStep) ageTicks.push(age);
  if (ageTicks[ageTicks.length - 1] !== maxAge) ageTicks.push(maxAge);

  function nearest(clientX: number, svg: SVGSVGElement) {
    const rect = svg.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * width;
    let best = 0;
    let bestDist = Infinity;
    data.forEach((_, index) => {
      const dist = Math.abs(xOf(index) - x);
      if (dist < bestDist) {
        bestDist = dist;
        best = index;
      }
    });
    setActive(best);
  }

  const tipLeft = Math.min(width - 148, Math.max(8, xOf(shownIndex) - 70));

  return (
    <div ref={wrap} className="w-full min-w-0">
      <div className="relative">
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={`股價由 ${axisPrice(first.usd)} 美元走到 ${axisPrice(last.usd)} 美元，峰值在 ${peak.age} 歲`}
          tabIndex={0}
          className="block w-full touch-none outline-none"
          onPointerMove={(event) => nearest(event.clientX, event.currentTarget)}
          onPointerLeave={() => setActive(null)}
          onKeyDown={(event) => {
            const current = active ?? data.length - 1;
            if (event.key === "ArrowLeft") {
              event.preventDefault();
              setActive(Math.max(0, current - 1));
            }
            if (event.key === "ArrowRight") {
              event.preventDefault();
              setActive(Math.min(data.length - 1, current + 1));
            }
          }}
        >
          {yTicks.map((tick) => {
            const y = yOf(tick);
            if (y < padT - 2 || y > floorY + 2) return null;
            return (
              <g key={tick}>
                <line x1={padL} x2={width - padR} y1={y} y2={y} stroke="var(--color-line)" strokeWidth="1" />
                <text x={padL - 8} y={y + 4} textAnchor="end" fill="var(--color-muted)" fontSize="11" fontFamily="IBM Plex Mono, ui-monospace, monospace">
                  {axisPrice(tick)}
                </text>
              </g>
            );
          })}
          {ageTicks.map((age) => {
            let index = 0;
            let dist = Infinity;
            data.forEach((point, i) => {
              const d = Math.abs(point.age - age);
              if (d < dist) {
                dist = d;
                index = i;
              }
            });
            const x = xOf(index);
            return (
              <text
                key={`${age}-${index}`}
                x={x}
                y={height - 8}
                textAnchor="middle"
                fill="var(--color-muted)"
                fontSize="11"
                fontFamily="IBM Plex Mono, ui-monospace, monospace"
              >
                {data[index]!.age}
              </text>
            );
          })}
          <path d={area} fill={stroke} opacity="0.14" />
          <path
            d={line}
            fill="none"
            stroke={stroke}
            strokeWidth="2.25"
            strokeLinejoin="round"
            strokeLinecap="round"
            pathLength={1}
            className={reduce ? undefined : "price-draw"}
          />
          <circle cx={xOf(0)} cy={yOf(first.usd)} r="3" fill="var(--color-ivory)" />
          <circle cx={xOf(data.length - 1)} cy={yOf(last.usd)} r="3.5" fill={stroke} />
          {peakAt !== 0 && peakAt !== data.length - 1 && (
            <g>
              <circle cx={xOf(peakAt)} cy={yOf(peak.usd)} r="4" fill="var(--color-gold)" />
              <text
                x={xOf(peakAt)}
                y={Math.max(14, yOf(peak.usd) - 10)}
                textAnchor="middle"
                fill="var(--color-gold)"
                fontSize="11"
              >
                峰值
              </text>
            </g>
          )}
          <line
            x1={xOf(shownIndex)}
            x2={xOf(shownIndex)}
            y1={padT}
            y2={floorY}
            stroke="var(--color-gold)"
            strokeOpacity="0.45"
            strokeDasharray="3 3"
          />
        </svg>
        <div
          className="pointer-events-none absolute rounded-xl border border-line bg-ink/95 px-3 py-2"
          style={{ left: tipLeft, top: 8 }}
        >
          <p className="font-mono text-xs text-gold">
            {shown.age}歲 · {shown.year}
          </p>
          <p className="font-mono text-lg leading-tight">USD {formatPrice(shown.usd)}</p>
          <p className={"font-mono text-xs " + (multiple >= 1 ? "text-up" : "text-down")}>
            自上市 {formatMultiple(multiple)}
          </p>
        </div>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-xs text-muted">上市</dt>
          <dd className="font-mono">USD {formatPrice(first.usd)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">峰值 · {peak.age}歲</dt>
          <dd className="font-mono text-gold">USD {formatPrice(peak.usd)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">除牌 · {last.age}歲</dt>
          <dd className="font-mono">USD {formatPrice(last.usd)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">股價倍數</dt>
          <dd className={"font-mono " + (last.usd >= first.usd ? "text-up" : "text-down")}>
            {formatMultiple(last.usd / first.usd)}
          </dd>
        </div>
      </dl>
    </div>
  );
}

function logTicks(min: number, max: number): number[] {
  const ticks: number[] = [];
  const start = Math.floor(Math.log10(min));
  const end = Math.ceil(Math.log10(max));
  for (let exp = start; exp <= end; exp += 1) {
    for (const m of [1, 2, 5]) {
      const value = m * 10 ** exp;
      if (value >= min * 0.999 && value <= max * 1.001) ticks.push(value);
    }
  }
  if (ticks.length <= 4) return ticks.length > 0 ? ticks : [min, max];
  const picked = [ticks[0]!];
  const step = (ticks.length - 1) / 3;
  for (let i = 1; i <= 3; i += 1) picked.push(ticks[Math.round(i * step)]!);
  return [...new Set(picked)];
}
