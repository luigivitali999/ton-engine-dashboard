"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import type { TimeRange } from "@/lib/types";

const OPTIONS: { value: TimeRange; label: string }[] = [
  { value: "today", label: "Oggi" },
  { value: "7d", label: "7 giorni" },
  { value: "30d", label: "30 giorni" },
  { value: "all", label: "All time" },
];

export function TimeRangeFilter({ active }: { active: TimeRange }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function select(v: TimeRange) {
    const next = new URLSearchParams(params.toString());
    next.set("range", v);
    router.push(`${pathname}?${next.toString()}`);
  }

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
      {OPTIONS.map((o) => {
        const isActive = o.value === active;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => select(o.value)}
            style={{
              fontSize: 11,
              padding: "4px 10px",
              borderRadius: 4,
              background: isActive ? "#ffffff" : "transparent",
              color: isActive ? "#0c0a09" : "#78716c",
              boxShadow: isActive ? "rgba(0,0,0,0.05) 0px 1px 2px 0px" : "none",
              border: "none",
              cursor: "pointer",
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
