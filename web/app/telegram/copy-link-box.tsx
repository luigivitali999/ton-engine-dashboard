"use client";

import { useState } from "react";

export function CopyLinkBox({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // no-op
    }
  }

  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
      <code
        style={{
          flex: 1,
          fontSize: 13,
          fontFamily: "monospace",
          color: "#0c0a09",
          background: "#f5f5f4",
          padding: "6px 10px",
          borderRadius: 4,
          wordBreak: "break-all",
        }}
      >
        {url}
      </code>
      <button
        onClick={copy}
        style={{
          background: copied ? "#16a34a" : "rgba(120,114,109,0.08)",
          color: copied ? "white" : "#0c0a09",
          border: "1px solid #e5e7eb",
          borderRadius: 4,
          padding: "6px 10px",
          fontSize: 12,
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        {copied ? "Copiato" : "Copia"}
      </button>
    </div>
  );
}
