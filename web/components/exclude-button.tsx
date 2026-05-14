"use client";

import { useState, useTransition } from "react";
import { X, RotateCcw } from "lucide-react";

export function ExcludeButton({
  linkId,
  excluded,
  onChange,
}: {
  linkId: string;
  excluded: boolean;
  /** Called with the new excluded state after a successful API mutation. */
  onChange?: (excluded: boolean) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useState(excluded);

  function toggle() {
    const next = !optimistic;
    setOptimistic(next);
    startTransition(async () => {
      const res = await fetch("/api/links/exclude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ linkId, excluded: next }),
      });
      if (!res.ok) {
        setOptimistic(!next);
        alert("Could not update exclusion. Try again.");
        return;
      }
      // Notify parent so it can update its own state — no router.refresh().
      onChange?.(next);
    });
  }

  if (optimistic) {
    return (
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        title="Riporta il link in dashboard"
        aria-label="Restore link"
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          background: "transparent",
          border: "none",
          color: "#78716c",
          cursor: pending ? "wait" : "pointer",
          padding: 4,
          borderRadius: 4,
          opacity: pending ? 0.5 : 1,
        }}
      >
        <RotateCcw size={13} />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      title="Escludi questo link dalla dashboard"
      aria-label="Exclude link"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        background: "transparent",
        border: "none",
        color: "#a8a29e",
        cursor: pending ? "wait" : "pointer",
        padding: 4,
        borderRadius: 4,
        transition: "color 0.12s",
        opacity: pending ? 0.5 : 1,
      }}
      onMouseEnter={(e) => (e.currentTarget.style.color = "#dc2626")}
      onMouseLeave={(e) => (e.currentTarget.style.color = "#a8a29e")}
    >
      <X size={13} />
    </button>
  );
}
