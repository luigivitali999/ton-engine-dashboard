"use client";

import { useRef, useState } from "react";

export interface TrendLine {
  tracking_link_id: string;
  label: string;
  promoter_name: string | null;
  color: string;
  total_joins: number;
  points: Array<{ day: string; cumulative: number }>;
}

const MONTHS_IT = [
  "gen",
  "feb",
  "mar",
  "apr",
  "mag",
  "giu",
  "lug",
  "ago",
  "set",
  "ott",
  "nov",
  "dic",
];

function formatDay(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${parseInt(d, 10)} ${MONTHS_IT[parseInt(m, 10) - 1] ?? ""}`;
}

const W = 1000;
const H = 130;
const PADDING_X_LEFT = 24;
const PADDING_TOP = 10;
const PADDING_BOTTOM = 15;

export function TrendChart({
  lines,
  days = 30,
}: {
  lines: TrendLine[];
  days?: number;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  if (lines.length === 0 || lines.every((l) => l.points.length === 0)) {
    return null;
  }

  // Series share the same day grid (we built them that way in the lib helper)
  const dayCount = lines[0].points.length;
  const labels = lines[0].points.map((p) => p.day);
  const allValues = lines.flatMap((l) => l.points.map((p) => p.cumulative));
  const maxY = Math.max(1, ...allValues);

  const chartW = W - PADDING_X_LEFT;
  const chartH = H - PADDING_TOP - PADDING_BOTTOM;
  const stepX = chartW / Math.max(1, dayCount - 1);

  const pathFor = (line: TrendLine) =>
    line.points
      .map((p, i) => {
        const x = PADDING_X_LEFT + i * stepX;
        const y = PADDING_TOP + chartH - (p.cumulative / maxY) * chartH;
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const xPx = e.clientX - rect.left;
    const xViewBox = (xPx / rect.width) * W - PADDING_X_LEFT;
    const idx = Math.min(
      dayCount - 1,
      Math.max(0, Math.round(xViewBox / stepX)),
    );
    setHoverIdx(idx);
  }

  const hover = hoverIdx;
  const hoverX = hover != null ? PADDING_X_LEFT + hover * stepX : 0;

  // Tooltip placement: flip when nearing right edge
  const tooltipLeftPct = (hoverX / W) * 100;
  const flipSide = tooltipLeftPct > 60;

  // Sort hover values desc so tooltip rows look like a leaderboard at the cursor
  const hoverRows =
    hover != null
      ? [...lines]
          .map((l) => ({ line: l, value: l.points[hover]?.cumulative ?? 0 }))
          .sort((a, b) => b.value - a.value)
      : [];

  // Y-axis ticks: 0 / mid / top
  const yTicks = [0, Math.round(maxY / 2), maxY];

  return (
    <div
      style={{
        background: "white",
        border: "1px solid #e5e7eb",
        borderRadius: 8,
        padding: "14px 16px",
        marginBottom: 14,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 8,
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 600 }}>
          Trend per link · {days} giorni
        </span>
        <span style={{ fontSize: 10, color: "#a8a29e" }}>
          join cumulati · passa il mouse per i dettagli
        </span>
      </div>

      <div style={{ position: "relative", height: H }}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          style={{
            width: "100%",
            height: "100%",
            display: "block",
            cursor: "crosshair",
          }}
          onMouseMove={onMove}
          onMouseLeave={() => setHoverIdx(null)}
        >
          {/* Grid lines */}
          {yTicks.map((tickValue) => {
            const y =
              PADDING_TOP + chartH - (tickValue / maxY) * chartH;
            return (
              <g key={tickValue}>
                <line
                  x1={PADDING_X_LEFT}
                  y1={y}
                  x2={W}
                  y2={y}
                  stroke="#f0efed"
                  strokeWidth={1}
                />
                <text
                  x={PADDING_X_LEFT - 2}
                  y={y + 3}
                  textAnchor="end"
                  fontSize={9}
                  fill="#a8a29e"
                >
                  {tickValue.toLocaleString()}
                </text>
              </g>
            );
          })}

          {/* X axis labels: only first and last */}
          <text
            x={PADDING_X_LEFT + 16}
            y={H - 3}
            fontSize={9}
            fill="#a8a29e"
            textAnchor="start"
          >
            {labels.length > 0 ? formatDay(labels[0]) : ""}
          </text>
          <text
            x={W - 4}
            y={H - 3}
            fontSize={9}
            fill="#a8a29e"
            textAnchor="end"
          >
            oggi
          </text>

          {/* Lines */}
          {lines.map((line) => (
            <path
              key={line.tracking_link_id}
              d={pathFor(line)}
              fill="none"
              stroke={line.color}
              strokeWidth={1.8}
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          ))}

          {/* Hover overlay */}
          {hover != null && (
            <>
              <line
                x1={hoverX}
                y1={PADDING_TOP}
                x2={hoverX}
                y2={PADDING_TOP + chartH}
                stroke="rgba(12,10,9,0.18)"
                strokeWidth={1}
                strokeDasharray="2,2"
                vectorEffect="non-scaling-stroke"
              />
              {lines.map((line) => {
                const v = line.points[hover]?.cumulative ?? 0;
                const y =
                  PADDING_TOP + chartH - (v / maxY) * chartH;
                return (
                  <circle
                    key={line.tracking_link_id}
                    cx={hoverX}
                    cy={y}
                    r={3}
                    fill="white"
                    stroke={line.color}
                    strokeWidth={2}
                    vectorEffect="non-scaling-stroke"
                  />
                );
              })}
            </>
          )}
        </svg>

        {hover != null && (
          <div
            style={{
              position: "absolute",
              top: 4,
              left: flipSide ? undefined : `${tooltipLeftPct}%`,
              right: flipSide ? `${100 - tooltipLeftPct}%` : undefined,
              transform: flipSide ? "translateX(-8px)" : "translateX(8px)",
              background: "#0c0a09",
              color: "white",
              fontSize: 11,
              padding: "6px 9px",
              borderRadius: 4,
              pointerEvents: "none",
              whiteSpace: "nowrap",
              boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
              zIndex: 5,
              minWidth: 130,
            }}
          >
            <div
              style={{
                fontWeight: 500,
                marginBottom: 4,
                opacity: 0.9,
                fontSize: 10,
              }}
            >
              {formatDay(labels[hover])}
            </div>
            {hoverRows.map((r) => (
              <div
                key={r.line.tracking_link_id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  margin: "2px 0",
                }}
              >
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: r.line.color,
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    opacity: 0.85,
                    minWidth: 70,
                    fontSize: 11,
                  }}
                >
                  {r.line.promoter_name ||
                    r.line.label ||
                    "(senza nome)"}
                </span>
                <span
                  style={{ marginLeft: "auto", fontWeight: 500 }}
                >
                  {r.value.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
