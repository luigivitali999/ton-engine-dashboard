"use client";

import { useState } from "react";

export default function UnlockPage() {
  const [pw, setPw] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setErrorMsg("");

    // Pick up ?from= to redirect back after unlock
    const params = new URLSearchParams(window.location.search);
    const next = params.get("from") || "/dashboard";

    const res = await fetch("/api/unlock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: pw }),
    });

    if (!res.ok) {
      setStatus("error");
      setErrorMsg(
        res.status === 401 ? "Password sbagliata." : "Errore di connessione.",
      );
      return;
    }
    window.location.href = next;
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#fafaf9",
        padding: 24,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 360,
          background: "#ffffff",
          borderRadius: 10,
          boxShadow: "rgba(0,0,0,0.05) 0px 4px 16px 0px",
          padding: 32,
        }}
      >
        <div
          style={{
            fontSize: 20,
            fontWeight: 500,
            color: "#0c0a09",
            letterSpacing: "-0.017px",
            marginBottom: 4,
          }}
        >
          TON-engine
        </div>
        <div style={{ fontSize: 13, color: "#78716c", marginBottom: 24 }}>
          PrimePro internal dashboard
        </div>

        <form onSubmit={handleSubmit}>
          <label
            style={{
              display: "block",
              fontSize: 12,
              color: "#78716c",
              marginBottom: 4,
            }}
          >
            Password
          </label>
          <input
            type="password"
            required
            autoFocus
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            disabled={status === "sending"}
            style={{
              width: "100%",
              fontSize: 14,
              padding: "8px 10px",
              border: "1px solid #d6d3d1",
              borderRadius: 4,
              color: "#0c0a09",
              outline: "none",
              marginBottom: 12,
              fontFamily: "inherit",
            }}
          />
          <button
            type="submit"
            disabled={status === "sending"}
            style={{
              width: "100%",
              background: "#3ba6f1",
              color: "#ffffff",
              fontSize: 13,
              fontWeight: 500,
              padding: "9px 14px",
              borderRadius: 9999,
              border: "none",
              opacity: status === "sending" ? 0.5 : 1,
              cursor: status === "sending" ? "not-allowed" : "pointer",
            }}
          >
            {status === "sending" ? "Verifico..." : "Entra"}
          </button>
        </form>

        {status === "error" && (
          <div
            style={{
              fontSize: 12,
              color: "#dc2626",
              marginTop: 12,
            }}
          >
            {errorMsg}
          </div>
        )}
      </div>
    </main>
  );
}
