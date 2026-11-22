"use client";
/**
 * Small, dependency-free SVG charts. Specs: bars ≤24px with 4px rounded data-ends
 * square at the baseline, 2px lines, ≥8px end markers with a surface ring,
 * hairline recessive grid, hover/focus tooltips (crosshair on lines, per-mark on
 * bars). Text uses ink tokens, never series colors.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";

function useWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(600);
  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setWidth(Math.max(220, Math.floor(w)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

/** Clean axis ticks that always enclose [min, max]. */
export function niceTicks(min: number, max: number, count = 4): number[] {
  if (!(max - min > 1e-9)) max = min + 1;
  const span = max - min;
  const mag = 10 ** Math.floor(Math.log10(span / count));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => Math.ceil(max / s) - Math.floor(min / s) <= count + 1) ?? 10 * mag;
  const start = Math.floor(min / step) * step;
  const end = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= end + step * 0.001; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  return ticks;
}

function barPath(x: number, base: number, end: number, w: number, r: number): string {
  const h = Math.abs(base - end);
  const rr = Math.min(r, h, w / 2);
  if (h < 0.5) return "";
  if (end < base) {
    return `M${x},${base} L${x},${end + rr} Q${x},${end} ${x + rr},${end} L${x + w - rr},${end} Q${x + w},${end} ${x + w},${end + rr} L${x + w},${base} Z`;
  }
  return `M${x},${base} L${x},${end - rr} Q${x},${end} ${x + rr},${end} L${x + w - rr},${end} Q${x + w},${end} ${x + w},${end - rr} L${x + w},${base} Z`;
}

interface TooltipState {
  x: number;
  y: number;
  content: ReactNode;
}

function Tooltip({ t }: { t: TooltipState | null }) {
  if (!t) return null;
  return (
    <div className="tooltip" style={{ left: t.x, top: t.y - 8 }} role="status">
      {t.content}
    </div>
  );
}

// ---------------------------------------------------------------------------

export interface ColumnDatum {
  label: string;
  detail?: string;
  value: number;
}

/** Column chart for a signed quantity (profit/loss): polarity colored by the diverging pair. */
export function ColumnChart({ data, height = 200, format, posLabel = "Profit", negLabel = "Loss" }: { data: ColumnDatum[]; height?: number; format: (v: number) => string; posLabel?: string; negLabel?: string }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const left = 54,
    right = 8,
    top = 10,
    bottom = 24;
  const vals = data.map((d) => d.value);
  const ticks = niceTicks(Math.min(0, ...vals), Math.max(0, ...vals));
  const lo = ticks[0]!,
    hi = ticks[ticks.length - 1]!;
  const ih = height - top - bottom;
  const y = (v: number) => top + ih - ((v - lo) / (hi - lo || 1)) * ih;
  const band = (width - left - right) / Math.max(1, data.length);
  const bw = Math.min(24, Math.max(2, band - 2));
  const labelEvery = Math.ceil(data.length / Math.max(1, Math.floor((width - left) / 34)));
  const bx = (i: number) => left + i * band + (band - bw) / 2;
  const tip: TooltipState | null =
    active === null || !data[active]
      ? null
      : {
          x: bx(active) + bw / 2,
          y: Math.min(y(data[active]!.value), y(0)),
          content: (
            <>
              <strong>{format(data[active]!.value)}</strong>
              <div className="muted">
                {data[active]!.label}
                {data[active]!.detail ? ` · ${data[active]!.detail}` : ""}
              </div>
            </>
          ),
        };
  return (
    <div className="chart" ref={ref} onPointerLeave={() => setActive(null)}>
      <div className="legend" aria-hidden="true">
        <span><span className="key-rect" style={{ background: "var(--pos)" }} />{posLabel}</span>
        <span><span className="key-rect" style={{ background: "var(--neg)" }} />{negLabel}</span>
      </div>
      <svg width={width} height={height} role="img" aria-label={`Column chart, ${data.length} values`}>
        {ticks.map((t) => (
          <g key={t}>
            <line className={t === 0 ? "base-line" : "grid-line"} x1={left} x2={width - right} y1={y(t)} y2={y(t)} />
            <text className="axis-label" x={left - 6} y={y(t) + 4} textAnchor="end">{format(t)}</text>
          </g>
        ))}
        {data.map((d, i) => {
          const path = barPath(bx(i), y(0), y(d.value), bw, 4);
          return (
            <g key={i}>
              {path && <path d={path} fill={d.value >= 0 ? "var(--pos)" : "var(--neg)"} opacity={active !== null && active !== i ? 0.7 : 1} />}
              <rect
                x={left + i * band}
                y={top}
                width={band}
                height={ih}
                fill="transparent"
                tabIndex={0}
                aria-label={`${d.label}: ${format(d.value)}`}
                onPointerMove={() => setActive(i)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
              />
              {i % labelEvery === 0 && (
                <text className="axis-label" x={bx(i) + bw / 2} y={height - 6} textAnchor="middle">{d.label}</text>
              )}
            </g>
          );
        })}
      </svg>
      <Tooltip t={tip} />
    </div>
  );
}

// ---------------------------------------------------------------------------

export interface LineSeries {
  name: string;
  color: string;
  values: number[];
  dashed?: boolean;
}

/** Line chart with crosshair tooltip. Keep to ≤3 series. */
export function LineChart({
  labels,
  series,
  height = 200,
  format,
  zeroLine = true,
  domain,
  showLegend,
}: {
  labels: string[];
  series: LineSeries[];
  height?: number;
  format: (v: number) => string;
  zeroLine?: boolean;
  domain?: [number, number];
  showLegend?: boolean;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const left = 54,
    right = 60,
    top = 10,
    bottom = 24;
  const all = series.flatMap((s) => s.values);
  const ticks = domain ? niceTicks(domain[0], domain[1]) : niceTicks(Math.min(zeroLine ? 0 : Infinity, ...all), Math.max(zeroLine ? 0 : -Infinity, ...all));
  const lo = ticks[0]!,
    hi = ticks[ticks.length - 1]!;
  const ih = height - top - bottom;
  const n = labels.length;
  const x = (i: number) => left + (n <= 1 ? 0 : (i / (n - 1)) * (width - left - right));
  const y = (v: number) => top + ih - ((v - lo) / (hi - lo || 1)) * ih;
  const labelEvery = Math.ceil(n / Math.max(1, Math.floor((width - left - right) / 40)));
  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const rect = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
    const px = e.clientX - rect.left;
    const i = Math.round(((px - left) / (width - left - right)) * (n - 1));
    setHover(Math.max(0, Math.min(n - 1, i)));
  };
  return (
    <div className="chart" ref={ref} onPointerLeave={() => setHover(null)}>
      {(showLegend ?? series.length > 1) && (
        <div className="legend" aria-hidden="true">
          {series.map((s) => (
            <span key={s.name}><span className="key-line" style={{ background: s.color }} />{s.name}</span>
          ))}
        </div>
      )}
      <svg width={width} height={height} role="img" aria-label={`Line chart: ${series.map((s) => s.name).join(", ")}`}>
        {ticks.map((t) => (
          <g key={t}>
            <line className={t === 0 && zeroLine ? "base-line" : "grid-line"} x1={left} x2={width - right} y1={y(t)} y2={y(t)} />
            <text className="axis-label" x={left - 6} y={y(t) + 4} textAnchor="end">{format(t)}</text>
          </g>
        ))}
        {labels.map((l, i) => (i % labelEvery === 0 ? <text key={i} className="axis-label" x={x(i)} y={height - 6} textAnchor="middle">{l}</text> : null))}
        {series.map((s) => (
          <g key={s.name}>
            <polyline fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" strokeDasharray={s.dashed ? "4 4" : undefined} points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(" ")} />
            {s.values.length > 0 && (
              <>
                <circle cx={x(s.values.length - 1)} cy={y(s.values[s.values.length - 1]!)} r={4} fill={s.color} stroke="var(--surface-1)" strokeWidth={2} />
                <text className="axis-label" x={x(s.values.length - 1) + 8} y={y(s.values[s.values.length - 1]!) + 4} style={{ fill: "var(--ink-2)" }}>
                  {format(s.values[s.values.length - 1]!)}
                </text>
              </>
            )}
          </g>
        ))}
        {hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={top} y2={top + ih} stroke="var(--axis)" strokeWidth={1} />
            {series.map((s) => (s.values[hover] !== undefined ? <circle key={s.name} cx={x(hover)} cy={y(s.values[hover]!)} r={4} fill={s.color} stroke="var(--surface-1)" strokeWidth={2} /> : null))}
          </g>
        )}
        <rect x={left} y={top} width={Math.max(0, width - left - right)} height={ih} fill="transparent" onPointerMove={onMove} />
      </svg>
      {hover !== null && (
        <Tooltip
          t={{
            x: x(hover),
            y: top + 4,
            content: (
              <>
                <div className="muted">{labels[hover]}</div>
                {series.map((s) => (
                  <div key={s.name}>
                    <span className="key-line" style={{ background: s.color }} />
                    <strong>{format(s.values[hover] ?? 0)}</strong> <span className="muted">{s.name}</span>
                  </div>
                ))}
              </>
            ),
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

/** One small line per variable on a shared 0–100 scale (small multiples instead of a 7-line tangle). */
export function SmallMultiples({ labels, items, height = 74 }: { labels: string[]; items: { name: string; values: number[]; note?: string }[]; height?: number }) {
  return (
    <div className="multiples">
      {items.map((it) => (
        <Multiple key={it.name} labels={labels} name={it.name} values={it.values} note={it.note} height={height} />
      ))}
    </div>
  );
}

function Multiple({ labels, name, values, note, height }: { labels: string[]; name: string; values: number[]; note?: string; height: number }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const top = 6,
    bottom = 6,
    left = 2,
    right = 6;
  const ih = height - top - bottom;
  const n = values.length;
  const x = (i: number) => left + (n <= 1 ? 0 : (i / (n - 1)) * (width - left - right));
  const y = (v: number) => top + ih - (Math.max(0, Math.min(100, v)) / 100) * ih;
  const last = values[n - 1] ?? 0;
  const first = values[0] ?? 0;
  const shown = hover !== null ? values[hover]! : last;
  return (
    <div>
      <div className="multiple-title">
        <span>{name}</span>
        <span className="num" style={{ color: "var(--ink)" }}>
          {Math.round(shown)}
          <span className="muted"> {hover !== null ? labels[hover] : `(${last - first >= 0 ? "+" : ""}${Math.round(last - first)})`}</span>
        </span>
      </div>
      <div className="chart" ref={ref} onPointerLeave={() => setHover(null)}>
        <svg width={width} height={height} role="img" aria-label={`${name}: ${Math.round(first)} to ${Math.round(last)} on a 0–100 scale`}>
          <line className="grid-line" x1={left} x2={width - right} y1={y(50)} y2={y(50)} />
          <line className="base-line" x1={left} x2={width - right} y1={y(0)} y2={y(0)} />
          <polygon fill="var(--series-1-wash)" points={`${x(0)},${y(0)} ${values.map((v, i) => `${x(i)},${y(v)}`).join(" ")} ${x(n - 1)},${y(0)}`} />
          <polyline fill="none" stroke="var(--series-1)" strokeWidth={2} strokeLinejoin="round" points={values.map((v, i) => `${x(i)},${y(v)}`).join(" ")} />
          {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={top} y2={top + ih} stroke="var(--axis)" />}
          <circle cx={x(hover ?? n - 1)} cy={y(hover !== null ? values[hover]! : last)} r={4} fill="var(--series-1)" stroke="var(--surface-1)" strokeWidth={2} />
          <rect
            x={0}
            y={0}
            width={width}
            height={height}
            fill="transparent"
            onPointerMove={(e) => {
              const r = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
              setHover(Math.max(0, Math.min(n - 1, Math.round(((e.clientX - r.left - left) / (width - left - right)) * (n - 1)))));
            }}
          />
        </svg>
      </div>
      {note && <div className="small muted">{note}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------

/** Horizontal range plot: p10–p90 band with a median dot, one row per scenario. */
export function RangeChart({ rows, format }: { rows: { label: string; p10: number; p50: number; p90: number; mean: number }[]; format: (v: number) => string }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [tip, setTip] = useState<TooltipState | null>(null);
  const labelW = Math.min(240, Math.max(120, width * 0.34));
  const right = 16,
    rowH = 30,
    top = 4,
    axisH = 22;
  const height = top + rows.length * rowH + axisH;
  const ticks = niceTicks(Math.min(0, ...rows.map((r) => r.p10)), Math.max(0, ...rows.map((r) => r.p90)), 5);
  const lo = ticks[0]!,
    hi = ticks[ticks.length - 1]!;
  const x = (v: number) => labelW + ((v - lo) / (hi - lo || 1)) * (width - labelW - right);
  return (
    <div className="chart" ref={ref} onPointerLeave={() => setTip(null)}>
      <div className="legend" aria-hidden="true">
        <span><span className="key-rect" style={{ background: "var(--series-1-wash)", outline: "1px solid var(--series-1)" }} />10th–90th percentile</span>
        <span><span className="key-rect" style={{ background: "var(--series-1)", borderRadius: "50%" }} />Median</span>
      </div>
      <svg width={width} height={height} role="img" aria-label="Range of outcomes per scenario">
        {ticks.map((t) => (
          <g key={t}>
            <line className={t === 0 ? "base-line" : "grid-line"} x1={x(t)} x2={x(t)} y1={top} y2={top + rows.length * rowH} />
            <text className="axis-label" x={x(t)} y={height - 6} textAnchor="middle">{format(t)}</text>
          </g>
        ))}
        {rows.map((r, i) => {
          const cy = top + i * rowH + rowH / 2;
          return (
            <g key={r.label}>
              <text x={labelW - 10} y={cy + 4} textAnchor="end" style={{ fontSize: 12, fill: "var(--ink-2)" }}>
                {r.label.length > 34 ? `${r.label.slice(0, 33)}…` : r.label}
              </text>
              <rect x={x(r.p10)} y={cy - 4} width={Math.max(2, x(r.p90) - x(r.p10))} height={8} rx={4} fill="var(--series-1-wash)" stroke="var(--series-1)" strokeWidth={1} />
              <circle cx={x(r.p50)} cy={cy} r={5} fill="var(--series-1)" stroke="var(--surface-1)" strokeWidth={2} />
              <rect
                x={labelW}
                y={cy - rowH / 2}
                width={width - labelW - right}
                height={rowH}
                fill="transparent"
                tabIndex={0}
                aria-label={`${r.label}: median ${format(r.p50)}, 10th ${format(r.p10)}, 90th ${format(r.p90)}`}
                onPointerMove={() => setTip({ x: x(r.p50), y: cy - 6, content: <><strong>{format(r.p50)}</strong> <span className="muted">median</span><div className="muted">{format(r.p10)} – {format(r.p90)} (10th–90th) · mean {format(r.mean)}</div></> })}
                onFocus={() => setTip({ x: x(r.p50), y: cy - 6, content: <><strong>{format(r.p50)}</strong> <span className="muted">median</span></> })}
                onBlur={() => setTip(null)}
              />
            </g>
          );
        })}
      </svg>
      <Tooltip t={tip} />
    </div>
  );
}

/** Diverging driver bars: what pushed a hidden variable up or down this week. */
export function DriverBars({ drivers, max }: { drivers: { label: string; value: number }[]; max?: number }) {
  const m = max ?? Math.max(0.01, ...drivers.map((d) => Math.abs(d.value)));
  return (
    <div className="drivers">
      {drivers.map((d) => (
        <div className="driver" key={d.label}>
          <span>{d.label}</span>
          <span className="driver-bar" aria-hidden="true">
            <span style={{ left: d.value >= 0 ? "50%" : `${50 - (Math.abs(d.value) / m) * 50}%`, width: `${(Math.abs(d.value) / m) * 50}%`, background: d.value >= 0 ? "var(--pos)" : "var(--neg)" }} />
            <span style={{ left: "50%", width: 1, background: "var(--axis)" }} />
          </span>
          <span className="num" style={{ textAlign: "right" }}>{d.value >= 0 ? "+" : "−"}{Math.abs(Math.round(d.value * 100) / 100)}</span>
        </div>
      ))}
    </div>
  );
}
