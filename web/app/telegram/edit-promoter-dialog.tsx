"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal, Label, Input, Btn, FormError } from "./modal";

export function EditPromoterDialog({
  promoterId,
  initialName,
  initialNotes,
}: {
  promoterId: string;
  initialName: string;
  initialNotes?: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(initialName);
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setErr(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/telegram/promoters/${promoterId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          notes: notes.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Errore salvataggio");
      setOpen(false);
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Errore di rete");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Modifica promoter"
        aria-label="Modifica promoter"
        style={{
          background: "transparent",
          border: "none",
          padding: 3,
          marginLeft: 4,
          cursor: "pointer",
          color: "#78716c",
          display: "inline-flex",
          alignItems: "center",
          borderRadius: 4,
        }}
        onMouseEnter={(e) =>
          (e.currentTarget.style.background = "rgba(120,114,109,0.1)")
        }
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      >
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
        </svg>
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Rinomina promoter"
      >
        <div style={{ marginBottom: 14 }}>
          <Label>Nome</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="es. Marco"
            autoFocus
          />
        </div>

        <div style={{ marginBottom: 14 }}>
          <Label>Note (opzionali)</Label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="es. canale Instagram, % revenue 20, contatto: @marco_92"
            style={{
              width: "100%",
              padding: "7px 10px",
              fontSize: 13,
              border: "1px solid #e5e7eb",
              borderRadius: 4,
              minHeight: 70,
              fontFamily: "inherit",
              resize: "vertical",
            }}
          />
        </div>

        <FormError msg={err} />

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
            marginTop: 16,
          }}
        >
          <Btn onClick={() => setOpen(false)}>Annulla</Btn>
          <Btn variant="primary" onClick={save} disabled={saving || !name.trim()}>
            {saving ? "Salvataggio..." : "Salva"}
          </Btn>
        </div>
      </Modal>
    </>
  );
}
