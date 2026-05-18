"use client";

import { useRef, useState } from "react";

interface Point {
  day: string;
  joins: number;
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
  const month = MONTHS_IT[parseInt(m, 10) - 1] ?? "";
  return `${parseInt(d, 10)} ${month}`;
}

export function Sparkline({ points }: { points: Point[] }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  if (points.length === 0) {
    return (
      <div
        style={{
          height: 90,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 11,
          color: "#a8a29e",
        }}
      >
        Nessun dato ancora.
      </div>
    );
  }

  const max = Math.max(1, ...points.map((p) => p.joins));
  const W = 400;
  const H = 90;
  const stepX = W / Math.max(1, points.length - 1);

  const path = points
    .map((p, i) => {
      const x = i * stepX;
      const y = H - (p.joins / max) * (H - 6) - 3;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const area = `${path} L${W},${H} L0,${H} Z`;

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const xPx = e.clientX - rect.left;
    const xViewBox = (xPx / rect.width) * W;
    const idx = Math.min(
      points.length - 1,
      Math.max(0, Math.round(xViewBox / stepX)),
    );
    setHoverIdx(idx);
  }

  const hover = hoverIdx != null ? points[hoverIdx] : null;
  const hoverX = hoverIdx != null ? hoverIdx * stepX : 0;
  const hoverY =
    hover != null ? H - (hover.joins / max) * (H - 6) - 3 : 0;

  // Tooltip horizontal placement: stick to mouse side, but flip if near right edge
  const tooltipLeftPct = (hoverX / W) * 100;
  const flipSide = tooltipLeftPct > 60;

  return (
    <div style={{ position: "relative", height: 90 }}>
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
        <defs>
          <linearGradient id="spark-grad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#3ba6f1" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#3ba6f1" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#spark-grad)" />
        <path d={path} fill="none" stroke="#3ba6f1" strokeWidth={1.5} />
        {hover != null && (
          <>
            <line
              x1={hoverX}
              y1={0}
              x2={hoverX}
              y2={H}
              stroke="rgba(12,10,9,0.2)"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
              strokeDasharray="2,2"
            />
            <circle
              cx={hoverX}
              cy={hoverY}
              r={4}
              fill="white"
              stroke="#3ba6f1"
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
            />
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
          }}
        >
          <div style={{ fontWeight: 500 }}>{formatDay(hover.day)}</div>
          <div style={{ fontSize: 10, opacity: 0.85, marginTop: 1 }}>
            {hover.joins} join
          </div>
        </div>
      )}
    </div>
  );
}
