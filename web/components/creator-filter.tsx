"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ChevronDown, X, Check, Search } from "lucide-react";
import type { Creator } from "@/lib/types";

export function CreatorFilter({
  creators,
  selectedIds,
}: {
  creators: Creator[];
  selectedIds: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return creators;
    return creators.filter((c) =>
      (c.user_name || c.nick_name || c.name || "").toLowerCase().includes(q),
    );
  }, [creators, query]);

  function commit(nextIds: string[]) {
    const next = new URLSearchParams(params.toString());
    if (nextIds.length === 0) {
      next.delete("creators");
    } else {
      next.set("creators", nextIds.join(","));
    }
    router.push(`${pathname}?${next.toString()}`);
  }

  function toggle(id: string) {
    const set = new Set(selectedIds);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    commit(Array.from(set));
  }

  function clear() {
    commit([]);
  }

  const allSelected = selectedIds.length === 0;
  const label = allSelected
    ? "All creators"
    : selectedIds.length === 1
      ? creators.find((c) => c.id === selectedIds[0])?.user_name ?? "1 creator"
      : `${selectedIds.length} creators`;

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          background: "rgba(120,114,109,0.08)",
          border: "1px solid #e5e7eb",
          borderRadius: 4,
          padding: "4px 10px",
          fontSize: 11,
          color: "#0c0a09",
          cursor: "pointer",
        }}
      >
        {label}
        <ChevronDown size={12} color="#78716c" />
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: 10,
            boxShadow: "rgba(0,0,0,0.05) 0px 4px 16px 0px",
            width: 280,
            zIndex: 50,
            overflow: "hidden",
          }}
        >
          {/* Search */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 10px",
              borderBottom: "1px solid #e5e7eb",
            }}
          >
            <Search size={12} color="#78716c" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cerca creator..."
              style={{
                flex: 1,
                border: "none",
                outline: "none",
                fontSize: 12,
                color: "#0c0a09",
                background: "transparent",
              }}
            />
            {!allSelected && (
              <button
                type="button"
                onClick={clear}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#78716c",
                  fontSize: 11,
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                Clear
              </button>
            )}
          </div>

          {/* List */}
          <div style={{ maxHeight: 260, overflowY: "auto" }}>
            {filtered.length === 0 ? (
              <div
                style={{
                  padding: "12px 10px",
                  fontSize: 12,
                  color: "#a8a29e",
                }}
              >
                Nessuna corrispondenza
              </div>
            ) : (
              filtered.map((c) => {
                const isSel = selectedIds.includes(c.id);
                const name = c.user_name || c.nick_name || c.name || "(no name)";
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => toggle(c.id)}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "8px 10px",
                      border: "none",
                      background: isSel ? "rgba(59,166,241,0.06)" : "transparent",
                      cursor: "pointer",
                      textAlign: "left",
                      fontSize: 12,
                      color: "#0c0a09",
                    }}
                    onMouseEnter={(e) => {
                      if (!isSel)
                        e.currentTarget.style.background =
                          "rgba(120,114,109,0.04)";
                    }}
                    onMouseLeave={(e) => {
                      if (!isSel)
                        e.currentTarget.style.background = "transparent";
                    }}
                  >
                    <span
                      style={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {name}
                    </span>
                    {isSel && <Check size={12} color="#3ba6f1" />}
                  </button>
                );
              })
            )}
          </div>

          {!allSelected && (
            <div
              style={{
                padding: "6px 10px",
                borderTop: "1px solid #e5e7eb",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span style={{ fontSize: 11, color: "#78716c" }}>
                {selectedIds.length} selected
              </span>
              <button
                type="button"
                onClick={clear}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  background: "transparent",
                  border: "none",
                  color: "#78716c",
                  fontSize: 11,
                  cursor: "pointer",
                }}
              >
                <X size={11} />
                Reset
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
