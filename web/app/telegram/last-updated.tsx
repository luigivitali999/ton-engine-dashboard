"use client";

import { useEffect, useState } from "react";

/**
 * Shows "Aggiornato Xs fa" relative to the moment the server last rendered
 * this page. The `at` prop is a server-generated ISO timestamp; whenever the
 * server re-renders (via router.refresh from AutoRefresh) it changes and
 * the counter resets.
 */
export function LastUpdated({ at }: { at: string }) {
  const renderedAt = new Date(at).getTime();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // When `at` changes (server re-render), reset the displayed delta immediately.
  useEffect(() => {
    setNow(Date.now());
  }, [at]);

  const deltaMs = Math.max(0, now - renderedAt);
  const sec = Math.floor(deltaMs / 1000);
  const label =
    sec < 2
      ? "appena ora"
      : sec < 60
        ? `${sec}s fa`
        : sec < 3600
          ? `${Math.floor(sec / 60)}m fa`
          : `${Math.floor(sec / 3600)}h fa`;

  const isStale = sec > 30;

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: 11,
        color: isStale ? "#a8a29e" : "#78716c",
      }}
      title={`Server render: ${new Date(at).toLocaleString("it-IT")}`}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: isStale ? "#a8a29e" : "#16a34a",
          animation: isStale ? "none" : "pulse 1.6s ease-in-out infinite",
        }}
      />
      Aggiornato {label} · polling 10s
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}
