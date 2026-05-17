"use client";

import { useState } from "react";

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* no-op */
    }
  }

  return (
    <button
      onClick={copy}
      style={{
        background: copied ? "#16a34a" : "rgba(120,114,109,0.08)",
        color: copied ? "white" : "#0c0a09",
        border: "1px solid #e5e7eb",
        borderRadius: 4,
        padding: "5px 10px",
        fontSize: 12,
        cursor: "pointer",
        whiteSpace: "nowrap",
      }}
    >
      {copied ? "Copiato" : "Copia link"}
    </button>
  );
}
