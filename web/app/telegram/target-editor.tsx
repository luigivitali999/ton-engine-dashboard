"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function TargetEditor({ initial }: { initial: number }) {
  const router = useRouter();
  const [value, setValue] = useState(String(initial));
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/telegram/target", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: Number(value) }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error || "Errore");
      } else {
        setMsg("Salvato.");
        router.refresh();
      }
    } catch {
      setMsg("Errore di rete");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div style={{ fontSize: 12, color: "#78716c", marginBottom: 6 }}>
        Target join
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <input
          type="number"
          min={1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          style={{
            flex: 1,
            padding: "6px 8px",
            fontSize: 13,
            border: "1px solid #e5e7eb",
            borderRadius: 4,
            minWidth: 0,
          }}
        />
        <button
          onClick={save}
          disabled={saving}
          style={{
            background: "#3ba6f1",
            color: "white",
            border: "none",
            borderRadius: 4,
            padding: "6px 12px",
            fontSize: 12,
            cursor: saving ? "default" : "pointer",
            opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? "..." : "Salva"}
        </button>
      </div>
      {msg && (
        <div style={{ fontSize: 11, color: "#78716c", marginTop: 6 }}>
          {msg}
        </div>
      )}
    </div>
  );
}
