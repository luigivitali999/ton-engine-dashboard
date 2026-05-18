"use client";

import { useRef, useState } from "react";

const DAY_LABELS_SHORT = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

interface HoverState {
  dow: number;
  hour: number;
  joins: number;
  cx: number; // center x in container coords
  cy: number; // top y in container coords
}

export function Heatmap({ matrix }: { matrix: number[][] }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<HoverState | null>(null);

  const max = Math.max(0, ...matrix.flat());

  function onCellEnter(
    e: React.MouseEvent<HTMLDivElement>,
    di: number,
    hi: number,
    v: number,
  ) {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const wrapRect = wrap.getBoundingClientRect();
    const cellRect = e.currentTarget.getBoundingClientRect();
    setHover({
      dow: di,
      hour: hi,
      joins: v,
      cx: cellRect.left - wrapRect.left + cellRect.width / 2,
      cy: cellRect.top - wrapRect.top,
    });
  }

  // Tooltip horizontal placement: if hovering near left/right edge, clamp
  const tooltipStyle: React.CSSProperties | null = hover
    ? {
        position: "absolute",
        left: hover.cx,
        top: hover.cy - 8,
        transform: "translate(-50%, -100%)",
        background: "#0c0a09",
        color: "white",
        fontSize: 11,
        padding: "6px 9px",
        borderRadius: 4,
        pointerEvents: "none",
        whiteSpace: "nowrap",
        boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
        zIndex: 5,
      }
    : null;

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      {matrix.map((row, di) => (
        <div
          key={di}
          style={{
            display: "grid",
            gridTemplateColumns: "32px repeat(24, 1fr)",
            gap: 2,
            marginBottom: 2,
          }}
        >
          <div
            style={{
              fontSize: 10,
              color: "#78716c",
              display: "flex",
              alignItems: "center",
            }}
          >
            {DAY_LABELS_SHORT[di].charAt(0)}
          </div>
          {row.map((v, hi) => {
            const level = max === 0 ? 0 : v / max;
            const bg =
              level === 0
                ? "#f0efed"
                : level < 0.25
                  ? "rgba(59,166,241,0.15)"
                  : level < 0.5
                    ? "rgba(59,166,241,0.35)"
                    : level < 0.75
                      ? "rgba(59,166,241,0.6)"
                      : "rgba(59,166,241,0.85)";
            const isActive =
              hover?.dow === di && hover?.hour === hi;
            return (
              <div
                key={hi}
                onMouseEnter={(e) => onCellEnter(e, di, hi, v)}
                onMouseLeave={() => setHover(null)}
                style={{
                  aspectRatio: "1",
                  borderRadius: 2,
                  background: bg,
                  cursor: "pointer",
                  boxShadow: isActive
                    ? "0 0 0 1.5px #3ba6f1"
                    : "none",
                  transition: "box-shadow 100ms ease-out",
                }}
              />
            );
          })}
        </div>
      ))}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "32px repeat(24, 1fr)",
          gap: 2,
          marginTop: 4,
          fontSize: 9,
          color: "#a8a29e",
        }}
      >
        <div />
        {Array.from({ length: 24 }, (_, h) => (
          <div key={h} style={{ textAlign: "center" }}>
            {h % 6 === 0 ? h : ""}
          </div>
        ))}
      </div>
      {hover && tooltipStyle && (
        <div style={tooltipStyle}>
          <div style={{ fontWeight: 500 }}>
            {DAY_LABELS_SHORT[hover.dow]} ·{" "}
            {String(hover.hour).padStart(2, "0")}:00 UTC
          </div>
          <div style={{ fontSize: 10, opacity: 0.85, marginTop: 1 }}>
            {hover.joins} {hover.joins === 1 ? "join" : "join"}
          </div>
        </div>
      )}
    </div>
  );
}
