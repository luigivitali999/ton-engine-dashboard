"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function TargetEditor({
  linkId,
  initial,
}: {
  linkId: string;
  initial: number;
}) {
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
        body: JSON.stringify({ linkId, target: Number(value) }),
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
    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
      <input
        type="number"
        min={1}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        style={{
          width: 100,
          padding: "5px 8px",
          fontSize: 12,
          border: "1px solid #e5e7eb",
          borderRadius: 4,
        }}
      />
      <button
        onClick={save}
        disabled={saving}
        style={{
          background: "#3ba6f1",
          color: "white",
          border: "1px solid #3ba6f1",
          borderRadius: 4,
          padding: "5px 12px",
          fontSize: 12,
          cursor: saving ? "default" : "pointer",
          opacity: saving ? 0.6 : 1,
        }}
      >
        {saving ? "..." : "Salva target"}
      </button>
      {msg && (
        <span style={{ fontSize: 11, color: "#78716c", marginLeft: 6 }}>
          {msg}
        </span>
      )}
    </div>
  );
}
