"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal, Label, Input, Select, Btn, FormError } from "./modal";

interface Promoter {
  id: string;
  name: string;
}

export function EditLinkDialog({
  linkId,
  initial,
}: {
  linkId: string;
  initial: {
    label: string | null;
    target_joins: number;
    promoter_id: string | null;
    is_active: boolean;
  };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [promoters, setPromoters] = useState<Promoter[]>([]);

  const [label, setLabel] = useState(initial.label ?? "");
  const [promoterId, setPromoterId] = useState<string>(
    initial.promoter_id ?? "",
  );
  const [target, setTarget] = useState(String(initial.target_joins));
  const [isActive, setIsActive] = useState(initial.is_active);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    fetch("/api/telegram/promoters")
      .then((r) => r.json())
      .then((j) => setPromoters(j.promoters ?? []))
      .catch(() => setPromoters([]));
  }, [open]);

  async function save() {
    setErr(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/telegram/tracking-links/${linkId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: label.trim() || null,
          promoter_id: promoterId || null,
          target_joins: Number(target),
          is_active: isActive,
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

  async function deactivate() {
    if (!confirm("Disattivare questo tracking link? I dati storici restano.")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/telegram/tracking-links/${linkId}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Errore");
      setOpen(false);
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Errore di rete");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          padding: "5px 12px",
          fontSize: 12,
          borderRadius: 4,
          border: "1px solid #e5e7eb",
          background: "white",
          color: "#0c0a09",
          cursor: "pointer",
        }}
      >
        Modifica
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Modifica tracking link"
      >
        <div style={{ marginBottom: 14 }}>
          <Label>Label</Label>
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="es. Marco · IG bio"
          />
        </div>

        <div style={{ marginBottom: 14 }}>
          <Label>Promoter</Label>
          <Select
            value={promoterId}
            onChange={(e) => setPromoterId(e.target.value)}
          >
            <option value="">— nessuno —</option>
            {promoters.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </div>

        <div style={{ marginBottom: 14 }}>
          <Label>Target join</Label>
          <Input
            type="number"
            min={1}
            value={target}
            onChange={(e) => setTarget(e.target.value)}
          />
        </div>

        <div style={{ marginBottom: 14 }}>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            Link attivo
          </label>
        </div>

        <FormError msg={err} />

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: 16,
          }}
        >
          <Btn variant="danger" onClick={deactivate} disabled={deleting}>
            {deleting ? "..." : "Disattiva"}
          </Btn>
          <div style={{ display: "flex", gap: 8 }}>
            <Btn onClick={() => setOpen(false)}>Annulla</Btn>
            <Btn variant="primary" onClick={save} disabled={saving}>
              {saving ? "Salvataggio..." : "Salva"}
            </Btn>
          </div>
        </div>
      </Modal>
    </>
  );
}
