"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal, Btn } from "./modal";

export function AddChannelDialog({ botUsername }: { botUsername: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [checking, setChecking] = useState(false);

  async function verify() {
    setChecking(true);
    router.refresh();
    // Give the server a moment to re-fetch, then close.
    setTimeout(() => {
      setChecking(false);
      setOpen(false);
    }, 800);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          background: "rgba(59,166,241,0.08)",
          border: "1px dashed rgba(59,166,241,0.3)",
          color: "#3ba6f1",
          padding: "10px",
          width: "100%",
          marginTop: 8,
          borderRadius: 6,
          fontSize: 12,
          cursor: "pointer",
          textAlign: "left",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <span
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            border: "1px dashed rgba(59,166,241,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 16,
          }}
        >
          +
        </span>
        Aggiungi canale
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Aggiungi un canale Telegram"
      >
        <p style={{ fontSize: 13, color: "#78716c", marginTop: 0 }}>
          Telegram non permette al bot di aggiungersi da solo. Segui questi
          passi:
        </p>
        <ol style={{ paddingLeft: 18, fontSize: 13, color: "#0c0a09", lineHeight: 1.7 }}>
          <li>
            Apri il canale Telegram da promuovere
          </li>
          <li>
            Vai su <strong>Manage channel → Administrators → Add admin</strong>
          </li>
          <li>
            Cerca <code style={{ background: "#f5f5f4", padding: "1px 6px", borderRadius: 3 }}>@{botUsername}</code> e selezionalo
          </li>
          <li>
            Conferma (i permessi di default vanno bene — l'importante è che sia admin)
          </li>
          <li>
            Premi <strong>Verifica</strong> qui sotto
          </li>
        </ol>

        <div
          style={{
            marginTop: 16,
            padding: 10,
            background: "#fafaf9",
            border: "1px solid #f0efed",
            borderRadius: 4,
            fontSize: 11,
            color: "#78716c",
          }}
        >
          Quando il bot diventa admin, Telegram ci manda un evento{" "}
          <code>my_chat_member</code> e il canale appare automaticamente nella
          sidebar.
        </div>

        <div
          style={{
            marginTop: 16,
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
          }}
        >
          <Btn onClick={() => setOpen(false)}>Annulla</Btn>
          <Btn variant="primary" onClick={verify} disabled={checking}>
            {checking ? "Verifica in corso..." : "Verifica"}
          </Btn>
        </div>
      </Modal>
    </>
  );
}
