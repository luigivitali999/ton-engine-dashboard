"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import type { TimeSeriesPoint } from "@/lib/queries";

type Metric = "revenue_net" | "subs";

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

function fmtValue(v: number, metric: Metric) {
  if (metric === "revenue_net") {
    return v.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: v < 100 ? 2 : 0,
      maximumFractionDigits: v < 100 ? 2 : 0,
    });
  }
  return Math.round(v).toLocaleString("en-US");
}

function fmtY(v: number, metric: Metric) {
  if (metric === "revenue_net") {
    if (v >= 1000) return `$${(v / 1000).toFixed(1)}k`;
    return `$${Math.round(v)}`;
  }
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
  return `${Math.round(v)}`;
}

export function CreatorMiniChart({
  data,
  rangeLabel,
}: {
  data: TimeSeriesPoint[];
  rangeLabel: string;
}) {
  const [metric, setMetric] = useState<Metric>("revenue_net");
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  const [hovered, setHovered] = useState<number | null>(null);
  const todayIso = new Date().toISOString().slice(0, 10);

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

  // Build per-day bar values for the selected metric
  const bars = useMemo(() => {
    return data.map((d) => ({
      date: d.date,
      value: (metric === "revenue_net" ? d.revenue_net : d.subs) || 0,
      isToday: d.date === todayIso,
      isReal: d.is_real,
    }));
  }, [data, metric, todayIso]);

  // Sum across the range
  const totalInRange = bars.reduce((acc, b) => acc + b.value, 0);

  if (bars.length === 0) {
    return (
      <div
        style={{
          padding: "16px 12px",
          fontSize: 11,
          color: "#a8a29e",
          fontStyle: "italic",
        }}
      >
        Nessun dato per il range selezionato.
      </div>
    );
  }

  // Chart geometry
  const height = 90;
  const padLeft = 50;
  const padRight = 14;
  const padTop = 10;
  const padBottom = 18;
  const chartW = Math.max(0, width - padLeft - padRight);
  const chartH = height - padTop - padBottom;

  const barW =
    bars.length > 0
      ? Math.max(3, Math.min(14, (chartW / bars.length) * 0.7))
      : 6;
  const stepX = bars.length > 1 ? chartW / (bars.length - 1) : chartW;

  const yMin = 0;
  const yMaxRaw = Math.max(1, ...bars.map((b) => b.value));
  const yMax = yMaxRaw * 1.12;
  const yRange = yMax - yMin || 1;

  const yToPx = (val: number) =>
    padTop + chartH - ((val - yMin) / yRange) * chartH;

  // Just top + bottom ticks for the y axis (keep it minimal)
  const ticks = [yMin, yMax];

  // X labels: just first and last
  const labelIndices = useMemo(() => {
    if (bars.length === 0) return [] as number[];
    if (bars.length === 1) return [0];
    return [0, bars.length - 1];
  }, [bars]);

  return (
    <div
      style={{
        padding: "10px 14px 14px",
        background: "rgba(250,250,249,0.6)",
        borderRadius: 6,
        marginBottom: 8,
      }}
    >
      {/* Header: total + metric toggle */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 4,
          gap: 8,
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span
            className="tnum"
            style={{ fontSize: 14, fontWeight: 500, color: "#0c0a09" }}
          >
            {fmtValue(totalInRange, metric)}
          </span>
          <span style={{ fontSize: 10, color: "#78716c" }}>
            {metric === "revenue_net" ? "net" : "subs"} · {rangeLabel}
          </span>
        </div>
        <div
          style={{
            display: "inline-flex",
            gap: 2,
            background: "rgba(120,114,109,0.10)",
            border: "1px solid #e5e7eb",
            borderRadius: 4,
            padding: 1,
          }}
        >
          <button
            type="button"
            onClick={() => setMetric("revenue_net")}
            style={{
              fontSize: 9,
              padding: "2px 7px",
              borderRadius: 3,
              background: metric === "revenue_net" ? "#fff" : "transparent",
              color: metric === "revenue_net" ? "#0c0a09" : "#78716c",
              border: "none",
              cursor: "pointer",
              fontWeight: metric === "revenue_net" ? 500 : 400,
            }}
          >
            Net
          </button>
          <button
            type="button"
            onClick={() => setMetric("subs")}
            style={{
              fontSize: 9,
              padding: "2px 7px",
              borderRadius: 3,
              background: metric === "subs" ? "#fff" : "transparent",
              color: metric === "subs" ? "#0c0a09" : "#78716c",
              border: "none",
              cursor: "pointer",
              fontWeight: metric === "subs" ? 500 : 400,
            }}
          >
            Subs
          </button>
        </div>
      </div>

      <div
        ref={containerRef}
        style={{ width: "100%", height, position: "relative" }}
      >
        <svg width={width} height={height} style={{ display: "block" }}>
          {/* Top + bottom grid lines */}
          {ticks.map((v, i) => (
            <g key={i}>
              <line
                x1={padLeft}
                y1={yToPx(v)}
                x2={width - padRight}
                y2={yToPx(v)}
                stroke="#e5e7eb"
                strokeDasharray="2 4"
                strokeWidth={0.5}
              />
              <text
                x={padLeft - 6}
                y={yToPx(v) + 3}
                textAnchor="end"
                fontSize={9}
                fill="#a8a29e"
              >
                {fmtY(v, metric)}
              </text>
            </g>
          ))}

          {/* Bars */}
          {bars.map((b, i) => {
            const x = padLeft + i * stepX;
            const barTop = yToPx(b.value);
            const barBottom = yToPx(0);
            const barH = Math.max(1, barBottom - barTop);
            const isHov = hovered === i;
            const accent = "#3ba6f1";
            const fillColor = b.isReal ? accent : "transparent";
            const strokeDash = b.isReal ? "0" : "2 2";
            const baseOpacity = b.isReal ? 0.92 : 0.4;
            const strokeW = b.isToday ? 1.5 : b.isReal ? 0 : 1;
            return (
              <g key={b.date}>
                {b.isToday && (
                  <circle
                    cx={x}
                    cy={barTop}
                    r={barW + 2}
                    fill="rgba(59,166,241,0.18)"
                    stroke="none"
                  >
                    <animate
                      attributeName="r"
                      values={`${barW};${barW + 6};${barW}`}
                      dur="2s"
                      repeatCount="indefinite"
                    />
                    <animate
                      attributeName="opacity"
                      values="0.7;0.1;0.7"
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
                  rx={1.5}
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
                />
              </g>
            );
          })}

          {/* X labels (first + last only) */}
          {labelIndices.map((idx) => {
            const b = bars[idx];
            const x = padLeft + idx * stepX;
            return (
              <text
                key={b.date}
                x={x}
                y={height - 4}
                textAnchor={idx === 0 ? "start" : "end"}
                fontSize={9}
                fill="#a8a29e"
              >
                {formatDateShort(b.date)}
              </text>
            );
          })}
        </svg>

        {/* Tooltip */}
        {hovered !== null &&
          (() => {
            const b = bars[hovered];
            const x = padLeft + hovered * stepX;
            const tooltipW = 150;
            const left = Math.max(
              4,
              Math.min(width - tooltipW - 4, x - tooltipW / 2),
            );
            return (
              <div
                style={{
                  position: "absolute",
                  top: 2,
                  left,
                  width: tooltipW,
                  background: "#fff",
                  border: "1px solid #e5e7eb",
                  borderRadius: 6,
                  boxShadow: "rgba(0,0,0,0.06) 0px 4px 12px 0px",
                  padding: "6px 9px",
                  fontSize: 10,
                  pointerEvents: "none",
                  zIndex: 5,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 2,
                    gap: 6,
                  }}
                >
                  <span style={{ color: "#0c0a09", fontWeight: 500 }}>
                    {formatDateLong(b.date)}
                  </span>
                  <span
                    style={{
                      fontSize: 8,
                      background: b.isReal
                        ? "rgba(59,166,241,0.15)"
                        : "rgba(120,114,109,0.12)",
                      color: b.isReal ? "#1e6da6" : "#78716c",
                      padding: "0 4px",
                      borderRadius: 9999,
                      fontWeight: 500,
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
                  <span>{metric === "revenue_net" ? "Net" : "Subs"}</span>
                  <span
                    className="tnum"
                    style={{ color: "#0c0a09", fontWeight: 500 }}
                  >
                    {fmtValue(b.value, metric)}
                  </span>
                </div>
              </div>
            );
          })()}
      </div>
    </div>
  );
}
