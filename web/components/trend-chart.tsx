"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

// -------- Types --------

export interface TimeSeriesPoint {
  date: string; // YYYY-MM-DD
  subs: number;
  revenue_net: number;
  revenue_gross: number;
  clicks: number;
  is_real: boolean;
}

export interface CreatorRanking {
  creator_id: string;
  creator_name: string;
  revenue_net: number;
  subs: number;
  paid_fans: number;
  link_count: number;
}

type Metric = "revenue_net" | "subs" | "clicks";
type View = "top" | "growth" | "daily";

const METRICS: { key: Metric; label: string; format: (n: number) => string }[] =
  [
    {
      key: "revenue_net",
      label: "Revenue net",
      format: (n) =>
        n.toLocaleString("en-US", {
          style: "currency",
          currency: "USD",
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }),
    },
    {
      key: "subs",
      label: "Subscribers",
      format: (n) => Math.round(n).toLocaleString("en-US"),
    },
    {
      key: "clicks",
      label: "Clicks",
      format: (n) => Math.round(n).toLocaleString("en-US"),
    },
  ];

function formatDateShort(iso: string) {
  const d = new Date(iso + "T00:00:00Z");
  return d.toLocaleDateString("it-IT", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

function formatDateLong(iso: string) {
  const d = new Date(iso + "T00:00:00Z");
  return d.toLocaleDateString("it-IT", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

// -------- Top component --------

export function TrendChart({
  timeSeries,
  topCreators,
  hideClicks = false,
}: {
  timeSeries: TimeSeriesPoint[];
  topCreators: CreatorRanking[];
  /** Pass true when current filter has 0 tracking links — no click data available. */
  hideClicks?: boolean;
}) {
  const trendActive = timeSeries.length >= 2;
  const [view, setView] = useState<View>(trendActive ? "daily" : "top");
  const [metric, setMetric] = useState<Metric>("revenue_net");

  // Reset metric to revenue_net if user picked "clicks" but it's been hidden
  if (metric === "clicks" && hideClicks) {
    setMetric("revenue_net");
  }

  const visibleMetrics = hideClicks
    ? METRICS.filter((m) => m.key !== "clicks")
    : METRICS;

  return (
    <div
      style={{
        background: "#ffffff",
        borderRadius: 10,
        boxShadow: "rgba(0,0,0,0.05) 0px 4px 16px 0px",
        padding: "22px 30px 26px",
        marginBottom: 14,
      }}
    >
      <Header
        view={view}
        setView={setView}
        metric={metric}
        setMetric={setMetric}
        trendActive={trendActive}
        showStima={view === "growth" || view === "daily"}
        visibleMetrics={visibleMetrics}
      />

      {view === "top" ? (
        <TopCreatorsView creators={topCreators} metric={metric} />
      ) : view === "daily" && trendActive ? (
        <DailyView data={timeSeries} metric={metric} />
      ) : view === "growth" && trendActive ? (
        <GrowthView data={timeSeries} metric={metric} />
      ) : (
        <EmptyState />
      )}
    </div>
  );
}

// -------- Header (compact, no subtitle, no banner) --------

function Header({
  view,
  setView,
  metric,
  setMetric,
  trendActive,
  showStima,
  visibleMetrics,
}: {
  view: View;
  setView: (v: View) => void;
  metric: Metric;
  setMetric: (m: Metric) => void;
  trendActive: boolean;
  showStima: boolean;
  visibleMetrics: { key: Metric; label: string }[];
}) {
  const title =
    view === "top"
      ? "Top creators"
      : view === "daily"
        ? "Daily"
        : "Growth";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        flexWrap: "wrap",
        marginBottom: 8,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 500, color: "#0c0a09" }}>
          {title}
        </div>
        {showStima && (
          <span
            style={{
              fontSize: 10,
              fontWeight: 500,
              background: "rgba(193,225,247,0.4)",
              color: "#1e6da6",
              padding: "1px 6px",
              borderRadius: 9999,
              letterSpacing: "0.02em",
              textTransform: "uppercase",
            }}
            title="Storico ricostruito dai cumulativi attuali · primo dato reale dopo il prossimo ingest"
          >
            Stima
          </span>
        )}
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <PillToggle
          options={[
            { key: "top", label: "Top creators" },
            { key: "daily", label: "Daily", disabled: !trendActive },
            { key: "growth", label: "Growth", disabled: !trendActive },
          ]}
          value={view}
          onChange={(v) => setView(v as View)}
        />
        <PillToggle
          options={visibleMetrics.map((m) => ({ key: m.key, label: m.label }))}
          value={metric}
          onChange={(v) => setMetric(v as Metric)}
        />
      </div>
    </div>
  );
}

function PillToggle({
  options,
  value,
  onChange,
}: {
  options: { key: string; label: string; disabled?: boolean }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div
      style={{
        display: "inline-flex",
        gap: 4,
        background: "rgba(120,114,109,0.08)",
        border: "1px solid #e5e7eb",
        borderRadius: 4,
        padding: 2,
      }}
    >
      {options.map((o) => {
        const isActive = o.key === value;
        return (
          <button
            key={o.key}
            type="button"
            disabled={o.disabled}
            onClick={() => !o.disabled && onChange(o.key)}
            style={{
              fontSize: 11,
              padding: "4px 10px",
              borderRadius: 4,
              background: isActive ? "#ffffff" : "transparent",
              color: o.disabled ? "#c9c5c2" : isActive ? "#0c0a09" : "#78716c",
              boxShadow: isActive
                ? "rgba(0,0,0,0.05) 0px 1px 2px 0px"
                : "none",
              border: "none",
              cursor: o.disabled ? "not-allowed" : "pointer",
              fontWeight: isActive ? 500 : 400,
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// -------- Top creators horizontal bar chart --------

function TopCreatorsView({
  creators,
  metric,
}: {
  creators: CreatorRanking[];
  metric: Metric;
}) {
  if (creators.length === 0) {
    return (
      <div
        style={{
          padding: "44px 0",
          textAlign: "center",
          color: "#a8a29e",
          fontSize: 12,
        }}
      >
        Nessun creator con link attivi.
      </div>
    );
  }

  const effectiveMetric: "revenue_net" | "subs" =
    metric === "clicks" ? "revenue_net" : metric;
  const config = METRICS.find((m) => m.key === effectiveMetric)!;

  const sorted = [...creators]
    .sort((a, b) => b[effectiveMetric] - a[effectiveMetric])
    .slice(0, 15);
  const max = Math.max(1, ...sorted.map((c) => c[effectiveMetric]));

  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {sorted.map((c) => {
          const pct = (c[effectiveMetric] / max) * 100;
          return (
            <div
              key={c.creator_id}
              style={{
                display: "grid",
                gridTemplateColumns: "150px 1fr 90px",
                alignItems: "center",
                gap: 10,
                padding: "5px 0",
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  color: "#0c0a09",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
                title={c.creator_name}
              >
                {c.creator_name}
              </div>
              <div
                style={{
                  position: "relative",
                  background: "rgba(120,114,109,0.08)",
                  height: 8,
                  borderRadius: 4,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    inset: "0 auto 0 0",
                    width: `${pct}%`,
                    background: "#3ba6f1",
                    borderRadius: 4,
                    transition: "width 200ms ease",
                  }}
                />
              </div>
              <div
                className="tnum"
                style={{
                  fontSize: 12,
                  textAlign: "right",
                  color: "#0c0a09",
                  fontWeight: 500,
                }}
              >
                {config.format(c[effectiveMetric])}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// -------- Growth area chart (cumulative) --------

function GrowthView({
  data,
  metric,
}: {
  data: TimeSeriesPoint[];
  metric: Metric;
}) {
  const config = METRICS.find((m) => m.key === metric)!;
  const todayIso = new Date().toISOString().slice(0, 10);

  // Build cumulative series from daily deltas (also carry is_real)
  const cumulative = useMemo(() => {
    let runningSubs = 0;
    let runningNet = 0;
    let runningClicks = 0;
    return data.map((d) => {
      runningSubs += d.subs;
      runningNet += d.revenue_net;
      runningClicks += d.clicks;
      return {
        date: d.date,
        subs: runningSubs,
        revenue_net: runningNet,
        clicks: runningClicks,
        is_real: d.is_real,
      };
    });
  }, [data]);

  const fmtY = (v: number) => {
    if (metric === "revenue_net") {
      if (v >= 1000) return `$${(v / 1000).toFixed(1)}k`;
      return `$${Math.round(v)}`;
    }
    if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
    return `${Math.round(v)}`;
  };

  // Dot rendering:
  // - today's point → pulsing blue
  // - other real points → small solid dot
  // - synthetic points → hidden
  const renderDot = (props: {
    cx?: number;
    cy?: number;
    payload?: { date?: string; is_real?: boolean };
  }) => {
    const { cx, cy, payload } = props;
    if (cx === undefined || cy === undefined) return <g />;
    if (payload?.date === todayIso) {
      return (
        <g>
          <circle
            cx={cx}
            cy={cy}
            r={9}
            fill="rgba(59,166,241,0.25)"
            stroke="none"
          >
            <animate
              attributeName="r"
              values="7;14;7"
              dur="2s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              values="0.7;0.05;0.7"
              dur="2s"
              repeatCount="indefinite"
            />
          </circle>
          <circle
            cx={cx}
            cy={cy}
            r={5}
            fill="#3ba6f1"
            stroke="#ffffff"
            strokeWidth={2}
          />
        </g>
      );
    }
    if (payload?.is_real) {
      return (
        <circle
          cx={cx}
          cy={cy}
          r={3}
          fill="#3ba6f1"
          stroke="#ffffff"
          strokeWidth={1.5}
        />
      );
    }
    return <g />;
  };

  return (
    <div style={{ height: 260, marginTop: 8 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={cumulative}
          margin={{ top: 20, right: 40, left: 14, bottom: 16 }}
        >
          <defs>
            <linearGradient id="growth-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3ba6f1" stopOpacity={0.22} />
              <stop offset="100%" stopColor="#3ba6f1" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            vertical={false}
            stroke="#e5e7eb"
            strokeDasharray="2 4"
          />
          <XAxis
            dataKey="date"
            tickFormatter={formatDateShort}
            tick={{ fill: "#78716c", fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: "#e5e7eb" }}
            interval="preserveStartEnd"
            minTickGap={32}
          />
          <YAxis
            tick={{ fill: "#78716c", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={fmtY}
            width={56}
          />
          <Tooltip
            contentStyle={{
              background: "#ffffff",
              border: "1px solid #e5e7eb",
              borderRadius: 8,
              boxShadow: "rgba(0,0,0,0.05) 0px 4px 16px 0px",
              fontSize: 12,
              padding: "8px 12px",
            }}
            labelFormatter={(label) => formatDateLong(label as string)}
            formatter={(value: number) => [config.format(value), config.label]}
            cursor={{ stroke: "#c1e1f7", strokeWidth: 1 }}
          />
          <Area
            type="monotone"
            dataKey={metric}
            stroke="#3ba6f1"
            strokeWidth={2}
            fill="url(#growth-fill)"
            dot={renderDot}
            activeDot={{
              r: 5,
              fill: "#3ba6f1",
              strokeWidth: 2,
              stroke: "#ffffff",
            }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}


// -------- Daily view (per-day bar chart with 7d rolling avg) --------

interface DailyBar {
  date: string;
  value: number;
  isToday: boolean;
  isReal: boolean;
}

function DailyView({
  data,
  metric,
}: {
  data: TimeSeriesPoint[];
  metric: Metric;
}) {
  const config = METRICS.find((m) => m.key === metric)!;
  const todayIso = new Date().toISOString().slice(0, 10);
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);
  const [hovered, setHovered] = useState<number | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0].contentRect.width;
      setWidth(Math.max(200, w));
    });
    ro.observe(el);
    setWidth(Math.max(200, el.getBoundingClientRect().width));
    return () => ro.disconnect();
  }, []);

  // Bars: one per day, height = activity in that day
  const bars = useMemo<DailyBar[]>(() => {
    const key: keyof Pick<TimeSeriesPoint, "revenue_net" | "subs" | "clicks"> =
      metric;
    return data.map((d) => ({
      date: d.date,
      value: (d[key] as number) || 0,
      isToday: d.date === todayIso,
      isReal: d.is_real,
    }));
  }, [data, metric, todayIso]);

  // Rolling 7-day average of REAL bars only (don't pollute avg with synthetic
  // smoothed values — those would distort the reference line)
  const realBars = useMemo(() => bars.filter((b) => b.isReal), [bars]);
  const avg7d = useMemo(() => {
    if (realBars.length === 0) return null;
    const lookback = realBars.slice(-7);
    return lookback.reduce((acc, b) => acc + b.value, 0) / lookback.length;
  }, [realBars]);

  const height = 260;
  const padLeft = 70;
  const padRight = 44;
  const padTop = 20;
  const padBottom = 34;
  const chartW = Math.max(0, width - padLeft - padRight);
  const chartH = height - padTop - padBottom;

  const barW =
    bars.length > 0
      ? Math.max(6, Math.min(30, (chartW / bars.length) * 0.65))
      : 10;
  const stepX = bars.length > 1 ? chartW / (bars.length - 1) : chartW;

  const yMin = 0;
  const yMaxRaw = Math.max(
    1,
    ...bars.map((b) => b.value),
    avg7d ?? 0,
  );
  const yMax = yMaxRaw * 1.12;
  const yRange = yMax - yMin || 1;

  const yToPixel = (val: number) =>
    padTop + chartH - ((val - yMin) / yRange) * chartH;

  const fmtY = (v: number) => {
    if (metric === "revenue_net") {
      if (v >= 1000) return `$${(v / 1000).toFixed(1)}k`;
      return `$${Math.round(v)}`;
    }
    if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
    return `${Math.round(v)}`;
  };

  const ticks = useMemo(() => {
    const n = 5;
    return Array.from({ length: n }, (_, i) => yMin + (yRange * i) / (n - 1));
  }, [yMin, yRange]);

  const labelIndices = useMemo(() => {
    if (bars.length === 0) return [];
    const target = Math.min(7, bars.length);
    const step = Math.max(1, Math.floor(bars.length / target));
    return bars.map((_, i) => i).filter((i) => i % step === 0);
  }, [bars]);

  if (bars.length === 0) return <EmptyState />;

  const avgY = avg7d !== null ? yToPixel(avg7d) : null;

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height, marginTop: 8, position: "relative" }}
    >
      <svg width={width} height={height} style={{ display: "block" }}>
        {/* Y grid */}
        {ticks.map((v, i) => (
          <g key={i}>
            <line
              x1={padLeft}
              y1={yToPixel(v)}
              x2={width - padRight}
              y2={yToPixel(v)}
              stroke="#e5e7eb"
              strokeDasharray="2 4"
            />
            <text
              x={padLeft - 8}
              y={yToPixel(v) + 3}
              textAnchor="end"
              fontSize={11}
              fill="#78716c"
            >
              {fmtY(v)}
            </text>
          </g>
        ))}

        {/* Bars */}
        {bars.map((b, i) => {
          const x = padLeft + i * stepX;
          const barTop = yToPixel(b.value);
          const barBottom = yToPixel(0);
          const barH = Math.max(2, barBottom - barTop);
          const isHov = hovered === i;
          const accent = "#3ba6f1";
          const fillColor = b.isReal ? accent : "transparent";
          const strokeDash = b.isReal ? "0" : "3 3";
          const baseOpacity = b.isReal ? 0.95 : 0.5;
          const strokeW = b.isToday ? 2 : b.isReal ? 0 : 1.2;

          return (
            <g key={b.date}>
              {/* Pulsing halo for today, at top of bar */}
              {b.isToday && (
                <circle
                  cx={x}
                  cy={barTop}
                  r={barW + 4}
                  fill="rgba(59,166,241,0.18)"
                  stroke="none"
                >
                  <animate
                    attributeName="r"
                    values={`${barW + 2};${barW + 12};${barW + 2}`}
                    dur="2s"
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="opacity"
                    values="0.7;0.05;0.7"
                    dur="2s"
                    repeatCount="indefinite"
                  />
                </circle>
              )}
              <rect
                x={x - barW / 2}
                y={barTop}
                width={barW}
                height={barH}
                fill={fillColor}
                stroke={accent}
                strokeWidth={strokeW}
                strokeDasharray={strokeDash}
                opacity={isHov ? 1 : baseOpacity}
                rx={2}
              />
              {/* Hit zone */}
              <rect
                x={x - stepX / 2}
                y={padTop}
                width={Math.max(stepX, barW + 4)}
                height={chartH}
                fill="transparent"
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
                style={{ cursor: "default" }}
              />
            </g>
          );
        })}

        {/* 7-day average line (over real bars only) */}
        {avgY !== null && (
          <g>
            <line
              x1={padLeft}
              y1={avgY}
              x2={width - padRight}
              y2={avgY}
              stroke="#78716c"
              strokeWidth={1.2}
              strokeDasharray="6 4"
              opacity={0.65}
            />
            <rect
              x={width - padRight - 96}
              y={avgY - 18}
              width={96}
              height={16}
              fill="#ffffff"
              opacity={0.85}
              rx={3}
            />
            <text
              x={width - padRight - 4}
              y={avgY - 6}
              textAnchor="end"
              fontSize={10}
              fill="#78716c"
              fontWeight={500}
            >
              media 7g · {fmtY(avg7d!)}
            </text>
          </g>
        )}

        {/* X labels */}
        {labelIndices.map((idx) => {
          const b = bars[idx];
          const x = padLeft + idx * stepX;
          return (
            <text
              key={b.date}
              x={x}
              y={height - 8}
              textAnchor="middle"
              fontSize={11}
              fill="#78716c"
            >
              {formatDateShort(b.date)}
            </text>
          );
        })}
      </svg>

      {/* Legend */}
      <div
        style={{
          position: "absolute",
          bottom: -2,
          left: padLeft,
          display: "flex",
          gap: 14,
          fontSize: 10,
          color: "#78716c",
        }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
          <span
            style={{
              display: "inline-block",
              width: 10,
              height: 10,
              background: "#3ba6f1",
              borderRadius: 2,
            }}
          />
          Reale
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
          <span
            style={{
              display: "inline-block",
              width: 10,
              height: 10,
              border: "1.2px dashed #3ba6f1",
              borderRadius: 2,
              opacity: 0.6,
            }}
          />
          Stima
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
          <span
            style={{
              display: "inline-block",
              width: 14,
              height: 0,
              borderTop: "1.2px dashed #78716c",
            }}
          />
          Media 7g (solo reali)
        </span>
      </div>

      {/* Tooltip */}
      {hovered !== null &&
        (() => {
          const b = bars[hovered];
          const x = padLeft + hovered * stepX;
          // Compare vs previous bar
          const prev = hovered > 0 ? bars[hovered - 1] : null;
          const delta = prev ? b.value - prev.value : null;
          const deltaPct =
            prev && prev.value !== 0
              ? ((b.value - prev.value) / Math.abs(prev.value)) * 100
              : null;
          // Compare vs 7d avg
          const vsAvg = avg7d !== null ? b.value - avg7d : null;
          const vsAvgPct =
            avg7d !== null && avg7d !== 0
              ? ((b.value - avg7d) / Math.abs(avg7d)) * 100
              : null;

          const tooltipW = 200;
          const left = Math.max(
            8,
            Math.min(width - tooltipW - 8, x - tooltipW / 2),
          );
          return (
            <div
              style={{
                position: "absolute",
                top: 4,
                left,
                width: tooltipW,
                background: "#ffffff",
                border: "1px solid #e5e7eb",
                borderRadius: 8,
                boxShadow: "rgba(0,0,0,0.05) 0px 4px 16px 0px",
                padding: "8px 12px",
                fontSize: 11,
                pointerEvents: "none",
                zIndex: 5,
              }}
            >
              <div
                style={{
                  fontWeight: 500,
                  color: "#0c0a09",
                  marginBottom: 4,
                  fontSize: 12,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span>{formatDateLong(b.date)}</span>
                <span
                  style={{
                    fontSize: 9,
                    background: b.isReal
                      ? "rgba(59,166,241,0.15)"
                      : "rgba(120,114,109,0.12)",
                    color: b.isReal ? "#1e6da6" : "#78716c",
                    padding: "1px 5px",
                    borderRadius: 9999,
                    fontWeight: 500,
                    letterSpacing: "0.02em",
                    textTransform: "uppercase",
                  }}
                >
                  {b.isReal ? "Reale" : "Stima"}
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  color: "#78716c",
                }}
              >
                <span>Quel giorno</span>
                <span
                  className="tnum"
                  style={{ color: "#0c0a09", fontWeight: 500 }}
                >
                  {config.format(b.value)}
                </span>
              </div>
              {delta !== null && deltaPct !== null && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginTop: 4,
                    paddingTop: 4,
                    borderTop: "1px solid #e5e7eb",
                    color: delta >= 0 ? "#3ba6f1" : "#78716c",
                    fontWeight: 500,
                  }}
                >
                  <span>{delta >= 0 ? "▲" : "▼"} vs ieri</span>
                  <span className="tnum">
                    {delta >= 0 ? "+" : ""}
                    {config.format(delta)} ({deltaPct >= 0 ? "+" : ""}
                    {deltaPct.toFixed(1)}%)
                  </span>
                </div>
              )}
              {vsAvg !== null && vsAvgPct !== null && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    color: vsAvg >= 0 ? "#3ba6f1" : "#78716c",
                  }}
                >
                  <span>vs media 7g</span>
                  <span className="tnum">
                    {vsAvg >= 0 ? "+" : ""}
                    {vsAvgPct.toFixed(1)}%
                  </span>
                </div>
              )}
            </div>
          );
        })()}
    </div>
  );
}

// -------- Empty state --------

function EmptyState() {
  return (
    <div
      style={{
        padding: "44px 0",
        textAlign: "center",
        color: "#a8a29e",
        fontSize: 12,
      }}
    >
      Nessun dato nel periodo selezionato.
    </div>
  );
}
