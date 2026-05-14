"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { LinkAggregate } from "@/lib/types";

type AxisPair =
  | { x: "subs"; y: "cvr"; xLabel: string; yLabel: string }
  | { x: "subs"; y: "earnings_net"; xLabel: string; yLabel: string }
  | { x: "earnings_net"; y: "cvr"; xLabel: string; yLabel: string };

const AXIS_PAIRS: AxisPair[] = [
  { x: "subs", y: "cvr", xLabel: "Subscribers", yLabel: "CVR (%)" },
  {
    x: "subs",
    y: "earnings_net",
    xLabel: "Subscribers",
    yLabel: "Revenue net ($)",
  },
  { x: "earnings_net", y: "cvr", xLabel: "Revenue net ($)", yLabel: "CVR (%)" },
];

type QuadrantKey = "replica" | "amplifica" | "aggiusta" | "riconsidera";

const QUADRANT_LABELS: Record<
  QuadrantKey,
  { label: string; hint: string; colorMain: string; colorSoft: string }
> = {
  replica: {
    label: "Replica",
    hint: "alti subs + alta CVR · pattern vincente",
    colorMain: "#1e6da6",
    colorSoft: "#3ba6f1",
  },
  amplifica: {
    label: "Amplifica",
    hint: "CVR alta · distribuzione bassa",
    colorMain: "#1e6da6",
    colorSoft: "#3ba6f1",
  },
  aggiusta: {
    label: "Aggiusta",
    hint: "volume buono · CVR bassa · funnel da rivedere",
    colorMain: "#854F0B",
    colorSoft: "#BA7517",
  },
  riconsidera: {
    label: "Riconsidera",
    hint: "entrambi bassi · candidati ad esclusione",
    colorMain: "#5F5E5A",
    colorSoft: "#a8a29e",
  },
};

function fmtUSD(n: number) {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: n >= 1000 ? 0 : 2,
    maximumFractionDigits: n >= 1000 ? 0 : 2,
  });
}

function fmtInt(n: number) {
  return n.toLocaleString("en-US");
}

function fmtPct(n: number | null) {
  if (n === null || n === undefined) return "—";
  return `${n.toFixed(1)}%`;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function quadrantOf(
  xVal: number,
  yVal: number,
  xMed: number,
  yMed: number,
): QuadrantKey {
  if (xVal > xMed && yVal > yMed) return "replica";
  if (xVal <= xMed && yVal > yMed) return "amplifica";
  if (xVal > xMed && yVal <= yMed) return "aggiusta";
  return "riconsidera";
}

export function EfficiencyQuadrant({
  links,
}: {
  links: LinkAggregate[];
}) {
  const [axes, setAxes] = useState<AxisPair>(AXIS_PAIRS[0]);
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);
  const [hovered, setHovered] = useState<number | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0].contentRect.width;
      setWidth(Math.max(400, w));
    });
    ro.observe(el);
    setWidth(Math.max(400, el.getBoundingClientRect().width));
    return () => ro.disconnect();
  }, []);

  // Points: pull (x, y) from each link based on current axis pair.
  // Skip links where the y-axis is CVR but cvr is null.
  const points = useMemo(() => {
    return links
      .map((l) => {
        const x =
          axes.x === "subs"
            ? l.subs
            : l.earnings_net;
        const y =
          axes.y === "earnings_net" ? l.earnings_net : (l.cvr ?? 0);
        return {
          link_id: l.link_id,
          link_name: l.link_name,
          creator_name: l.creator_name,
          x,
          y,
          // Keep the underlying values for the tooltip even if not on axes
          subs: l.subs,
          paying_fans: l.paying_fans,
          earnings_net: l.earnings_net,
          earnings_gross: l.earnings_gross,
          cvr: l.cvr,
        };
      })
      .filter((p) => {
        // Drop points where the y-axis is CVR but the link has no CVR
        if (axes.y === "cvr" && p.cvr === null) return false;
        return true;
      });
  }, [links, axes]);

  // Medians over the visible points
  const xMed = useMemo(() => median(points.map((p) => p.x)), [points]);
  const yMed = useMemo(() => median(points.map((p) => p.y)), [points]);

  // Quadrant counts for the corner badges
  const counts = useMemo(() => {
    const acc: Record<QuadrantKey, number> = {
      replica: 0,
      amplifica: 0,
      aggiusta: 0,
      riconsidera: 0,
    };
    for (const p of points) {
      acc[quadrantOf(p.x, p.y, xMed, yMed)]++;
    }
    return acc;
  }, [points, xMed, yMed]);

  // Chart geometry
  const height = 360;
  const padLeft = 64;
  const padRight = 28;
  const padTop = 28;
  const padBottom = 44;
  const chartW = Math.max(0, width - padLeft - padRight);
  const chartH = height - padTop - padBottom;

  // Axis ranges with padding
  const xVals = points.map((p) => p.x);
  const yVals = points.map((p) => p.y);
  const xMin = 0;
  const xMaxRaw = Math.max(1, ...xVals);
  const xMax = xMaxRaw * 1.05;
  const yMin = 0;
  const yMaxRaw = Math.max(1, ...yVals);
  const yMax = yMaxRaw * 1.1;

  const xToPx = (val: number) =>
    padLeft + ((val - xMin) / (xMax - xMin || 1)) * chartW;
  const yToPx = (val: number) =>
    padTop + chartH - ((val - yMin) / (yMax - yMin || 1)) * chartH;

  // Median pixel positions
  const xMedPx = xToPx(xMed);
  const yMedPx = yToPx(yMed);

  // Formatters per axis type
  const fmtAxis = (val: number, axisKey: "subs" | "cvr" | "earnings_net") => {
    if (axisKey === "earnings_net") {
      return val >= 1000 ? `$${(val / 1000).toFixed(1)}k` : `$${Math.round(val)}`;
    }
    if (axisKey === "cvr") return `${val.toFixed(1)}%`;
    return Math.round(val).toLocaleString("en-US");
  };

  // Y axis ticks (5 evenly spaced)
  const yTicks = useMemo(() => {
    const n = 5;
    return Array.from({ length: n }, (_, i) => yMin + ((yMax - yMin) * i) / (n - 1));
  }, [yMin, yMax]);
  // X axis ticks
  const xTicks = useMemo(() => {
    const n = 5;
    return Array.from({ length: n }, (_, i) => xMin + ((xMax - xMin) * i) / (n - 1));
  }, [xMin, xMax]);

  function scrollToLinkRow(linkId: string) {
    // Try to find a row in the LinksTable rendered below
    const el = document.querySelector<HTMLElement>(
      `[data-link-id="${linkId}"]`,
    );
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("link-row-highlight");
    setTimeout(() => el.classList.remove("link-row-highlight"), 2000);
  }

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
      {/* Header */}
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
        <div>
          <div style={{ fontSize: 13, fontWeight: 500, color: "#0c0a09" }}>
            Efficiency quadrant
          </div>
          <div style={{ fontSize: 11, color: "#78716c", marginTop: 2 }}>
            {points.length} link · mediane dinamiche · click su un punto per
            saltare alla riga della tabella
          </div>
        </div>
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
          {AXIS_PAIRS.map((pair, i) => {
            const key = `${pair.x}-${pair.y}`;
            const activeKey = `${axes.x}-${axes.y}`;
            const isActive = key === activeKey;
            const label =
              pair.x === "subs" && pair.y === "cvr"
                ? "Subs × CVR"
                : pair.x === "subs" && pair.y === "earnings_net"
                  ? "Subs × Net"
                  : "Net × CVR";
            return (
              <button
                key={i}
                type="button"
                onClick={() => setAxes(pair)}
                style={{
                  fontSize: 11,
                  padding: "4px 10px",
                  borderRadius: 4,
                  background: isActive ? "#ffffff" : "transparent",
                  color: isActive ? "#0c0a09" : "#78716c",
                  boxShadow: isActive
                    ? "rgba(0,0,0,0.05) 0px 1px 2px 0px"
                    : "none",
                  border: "none",
                  cursor: "pointer",
                  fontWeight: isActive ? 500 : 400,
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Chart */}
      <div
        ref={containerRef}
        style={{ width: "100%", height, marginTop: 8, position: "relative" }}
      >
        {points.length < 4 ? (
          <div
            style={{
              padding: "60px 0",
              textAlign: "center",
              color: "#a8a29e",
              fontSize: 12,
            }}
          >
            Servono almeno 4 link con valori per le metriche selezionate.
          </div>
        ) : (
          <svg width={width} height={height} style={{ display: "block" }}>
            {/* Quadrant background tints */}
            <rect
              x={padLeft}
              y={padTop}
              width={xMedPx - padLeft}
              height={yMedPx - padTop}
              fill="rgba(59,166,241,0.05)"
            />
            <rect
              x={xMedPx}
              y={padTop}
              width={padLeft + chartW - xMedPx}
              height={yMedPx - padTop}
              fill="rgba(59,166,241,0.10)"
            />
            <rect
              x={padLeft}
              y={yMedPx}
              width={xMedPx - padLeft}
              height={padTop + chartH - yMedPx}
              fill="rgba(120,114,109,0.05)"
            />
            <rect
              x={xMedPx}
              y={yMedPx}
              width={padLeft + chartW - xMedPx}
              height={padTop + chartH - yMedPx}
              fill="rgba(250,199,117,0.10)"
            />

            {/* Frame */}
            <rect
              x={padLeft}
              y={padTop}
              width={chartW}
              height={chartH}
              fill="none"
              stroke="#e5e7eb"
              strokeWidth={0.5}
            />

            {/* Median split lines */}
            <line
              x1={xMedPx}
              y1={padTop}
              x2={xMedPx}
              y2={padTop + chartH}
              stroke="#a8a29e"
              strokeDasharray="4 4"
              strokeWidth={1}
            />
            <line
              x1={padLeft}
              y1={yMedPx}
              x2={padLeft + chartW}
              y2={yMedPx}
              stroke="#a8a29e"
              strokeDasharray="4 4"
              strokeWidth={1}
            />

            {/* Corner labels with quadrant counts */}
            <text
              x={padLeft + chartW - 4}
              y={padTop + 14}
              textAnchor="end"
              fontSize={12}
              fontWeight={500}
              fill={QUADRANT_LABELS.replica.colorMain}
            >
              Replica · {counts.replica}
            </text>
            <text
              x={padLeft + 4}
              y={padTop + 14}
              fontSize={12}
              fontWeight={500}
              fill={QUADRANT_LABELS.amplifica.colorMain}
            >
              Amplifica · {counts.amplifica}
            </text>
            <text
              x={padLeft + chartW - 4}
              y={padTop + chartH - 6}
              textAnchor="end"
              fontSize={12}
              fontWeight={500}
              fill={QUADRANT_LABELS.aggiusta.colorMain}
            >
              Aggiusta · {counts.aggiusta}
            </text>
            <text
              x={padLeft + 4}
              y={padTop + chartH - 6}
              fontSize={12}
              fontWeight={500}
              fill={QUADRANT_LABELS.riconsidera.colorMain}
            >
              Riconsidera · {counts.riconsidera}
            </text>

            {/* Y ticks */}
            {yTicks.map((v, i) => (
              <g key={`y-${i}`}>
                <text
                  x={padLeft - 8}
                  y={yToPx(v) + 3}
                  textAnchor="end"
                  fontSize={10}
                  fill="#78716c"
                >
                  {fmtAxis(v, axes.y)}
                </text>
              </g>
            ))}
            {/* Y median label */}
            <text
              x={padLeft - 8}
              y={yMedPx + 3}
              textAnchor="end"
              fontSize={10}
              fontWeight={500}
              fill="#0c0a09"
            >
              {fmtAxis(yMed, axes.y)}
            </text>

            {/* X ticks */}
            {xTicks.map((v, i) => (
              <g key={`x-${i}`}>
                <text
                  x={xToPx(v)}
                  y={padTop + chartH + 14}
                  textAnchor="middle"
                  fontSize={10}
                  fill="#78716c"
                >
                  {fmtAxis(v, axes.x)}
                </text>
              </g>
            ))}
            {/* X median label */}
            <text
              x={xMedPx}
              y={padTop + chartH + 14}
              textAnchor="middle"
              fontSize={10}
              fontWeight={500}
              fill="#0c0a09"
            >
              {fmtAxis(xMed, axes.x)}
            </text>

            {/* Axis titles */}
            <text
              x={padLeft + chartW / 2}
              y={padTop + chartH + 34}
              textAnchor="middle"
              fontSize={11}
              fill="#78716c"
            >
              {axes.xLabel}
            </text>
            <text
              x={16}
              y={padTop + chartH / 2}
              fontSize={11}
              fill="#78716c"
              textAnchor="middle"
              transform={`rotate(-90 16 ${padTop + chartH / 2})`}
            >
              {axes.yLabel}
            </text>

            {/* Points */}
            {points.map((p, i) => {
              const cx = xToPx(p.x);
              const cy = yToPx(p.y);
              const q = quadrantOf(p.x, p.y, xMed, yMed);
              const isHov = hovered === i;
              // Distinct visual treatment per quadrant
              let fill = "#3ba6f1";
              let stroke = "#3ba6f1";
              let r = 5;
              let strokeWidth = 0;
              if (q === "replica") {
                fill = "#3ba6f1";
                stroke = "#3ba6f1";
                r = 5.5;
              } else if (q === "amplifica") {
                fill = "rgba(59,166,241,0.15)";
                stroke = "#3ba6f1";
                strokeWidth = 1.4;
                r = 5;
              } else if (q === "aggiusta") {
                fill = "rgba(250,199,117,0.2)";
                stroke = "#BA7517";
                strokeWidth = 1.2;
                r = 4.5;
              } else {
                fill = "rgba(168,162,158,0.4)";
                stroke = "#a8a29e";
                strokeWidth = 0.8;
                r = 4;
              }
              return (
                <g key={p.link_id}>
                  <circle
                    cx={cx}
                    cy={cy}
                    r={isHov ? r + 2 : r}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={isHov ? Math.max(strokeWidth, 1.6) : strokeWidth}
                    opacity={isHov ? 1 : 0.92}
                    style={{ cursor: "pointer", transition: "r 100ms" }}
                    onMouseEnter={() => setHovered(i)}
                    onMouseLeave={() => setHovered(null)}
                    onClick={() => scrollToLinkRow(p.link_id)}
                  />
                </g>
              );
            })}
          </svg>
        )}

        {/* Tooltip */}
        {hovered !== null &&
          (() => {
            const p = points[hovered];
            const cx = xToPx(p.x);
            const cy = yToPx(p.y);
            const q = quadrantOf(p.x, p.y, xMed, yMed);
            const ql = QUADRANT_LABELS[q];
            const tooltipW = 220;
            // Place tooltip on whichever side has room
            const left =
              cx + tooltipW + 16 < width
                ? Math.min(cx + 14, width - tooltipW - 8)
                : Math.max(8, cx - tooltipW - 14);
            const top = Math.max(4, Math.min(height - 130, cy - 64));
            return (
              <div
                style={{
                  position: "absolute",
                  top,
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
                    fontSize: 12,
                    marginBottom: 2,
                  }}
                >
                  {p.creator_name}
                </div>
                <div
                  style={{
                    fontSize: 10,
                    color: "#78716c",
                    marginBottom: 6,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                  title={p.link_name}
                >
                  {p.link_name}
                </div>
                <div
                  style={{
                    display: "inline-block",
                    fontSize: 9,
                    fontWeight: 500,
                    background: `${ql.colorSoft}22`,
                    color: ql.colorMain,
                    padding: "1px 6px",
                    borderRadius: 9999,
                    marginBottom: 6,
                    textTransform: "uppercase",
                    letterSpacing: "0.02em",
                  }}
                >
                  {ql.label}
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto",
                    gap: "2px 8px",
                    fontSize: 10.5,
                  }}
                >
                  <span style={{ color: "#78716c" }}>Subs</span>
                  <span className="tnum" style={{ color: "#0c0a09" }}>
                    {fmtInt(p.subs)}
                  </span>
                  <span style={{ color: "#78716c" }}>Paid</span>
                  <span className="tnum" style={{ color: "#0c0a09" }}>
                    {fmtInt(p.paying_fans)}
                  </span>
                  <span style={{ color: "#78716c" }}>Net</span>
                  <span
                    className="tnum"
                    style={{ color: "#0c0a09", fontWeight: 500 }}
                  >
                    {fmtUSD(p.earnings_net)}
                  </span>
                  <span style={{ color: "#78716c" }}>CVR</span>
                  <span className="tnum" style={{ color: "#0c0a09" }}>
                    {fmtPct(p.cvr)}
                  </span>
                </div>
                <div
                  style={{
                    marginTop: 6,
                    paddingTop: 6,
                    borderTop: "1px solid #e5e7eb",
                    fontSize: 10,
                    color: "#78716c",
                  }}
                >
                  Click per saltare alla riga
                </div>
              </div>
            );
          })()}
      </div>

      {/* Legend */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 18,
          fontSize: 10,
          color: "#78716c",
          marginTop: 8,
          paddingLeft: 4,
        }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              width: 10,
              height: 10,
              background: "#3ba6f1",
              borderRadius: 999,
            }}
          />
          Replica
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              width: 10,
              height: 10,
              border: "1.4px solid #3ba6f1",
              borderRadius: 999,
            }}
          />
          Amplifica
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              width: 10,
              height: 10,
              background: "rgba(250,199,117,0.25)",
              border: "1.2px solid #BA7517",
              borderRadius: 999,
            }}
          />
          Aggiusta
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              width: 10,
              height: 10,
              background: "rgba(168,162,158,0.4)",
              border: "0.8px solid #a8a29e",
              borderRadius: 999,
            }}
          />
          Riconsidera
        </span>
      </div>
    </div>
  );
}
