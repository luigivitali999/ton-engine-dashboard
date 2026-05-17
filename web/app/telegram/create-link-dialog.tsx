"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal, Label, Input, Select, Btn, FormError } from "./modal";

interface Promoter {
  id: string;
  name: string;
}

export function CreateLinkDialog({
  chatId,
  buttonStyle,
}: {
  chatId: number;
  buttonStyle?: "primary" | "ghost";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [promoters, setPromoters] = useState<Promoter[]>([]);
  const [loadingPromoters, setLoadingPromoters] = useState(false);

  // form state
  const [mode, setMode] = useState<"via_bot" | "from_url">("via_bot");
  const [inviteUrl, setInviteUrl] = useState("");
  const [label, setLabel] = useState("");
  const [promoterId, setPromoterId] = useState<string>("");
  const [newPromoterName, setNewPromoterName] = useState("");
  const [target, setTarget] = useState("1000");

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoadingPromoters(true);
    fetch("/api/telegram/promoters")
      .then((r) => r.json())
      .then((j) => setPromoters(j.promoters ?? []))
      .catch(() => setPromoters([]))
      .finally(() => setLoadingPromoters(false));
  }, [open]);

  function reset() {
    setMode("via_bot");
    setInviteUrl("");
    setLabel("");
    setPromoterId("");
    setNewPromoterName("");
    setTarget("1000");
    setErr(null);
  }

  async function submit() {
    setErr(null);
    setSaving(true);

    try {
      // Optional: create promoter inline first
      let pId: string | null = promoterId || null;
      if (promoterId === "__new__") {
        const name = newPromoterName.trim();
        if (!name) {
          setErr("Inserisci il nome del nuovo promoter.");
          setSaving(false);
          return;
        }
        const pRes = await fetch("/api/telegram/promoters", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        });
        const pJson = await pRes.json();
        if (!pRes.ok) throw new Error(pJson.error || "Errore creazione promoter");
        pId = pJson.promoter.id;
      }

      const body: Record<string, unknown> = {
        chat_id: chatId,
        mode,
        label: label.trim() || null,
        promoter_id: pId,
        target_joins: Number(target) || 1000,
      };
      if (mode === "from_url") body.invite_link = inviteUrl.trim();

      const res = await fetch("/api/telegram/tracking-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Errore creazione link");

      reset();
      setOpen(false);
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Errore di rete");
    } finally {
      setSaving(false);
    }
  }

  const trigger = (
    <button
      onClick={() => setOpen(true)}
      style={{
        padding: "6px 14px",
        fontSize: 12,
        borderRadius: 4,
        border:
          buttonStyle === "primary"
            ? "1px solid #3ba6f1"
            : "1px solid #e5e7eb",
        background: buttonStyle === "primary" ? "#3ba6f1" : "white",
        color: buttonStyle === "primary" ? "white" : "#0c0a09",
        cursor: "pointer",
      }}
    >
      + Crea tracking link
    </button>
  );

  return (
    <>
      {trigger}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Nuovo tracking link"
        maxWidth={520}
      >
        <div style={{ marginBottom: 14 }}>
          <Label>Modalità</Label>
          <div style={{ display: "flex", gap: 8 }}>
            <label
              style={{
                flex: 1,
                padding: 10,
                border: `1px solid ${mode === "via_bot" ? "#3ba6f1" : "#e5e7eb"}`,
                background:
                  mode === "via_bot" ? "rgba(59,166,241,0.04)" : "white",
                borderRadius: 4,
                cursor: "pointer",
                fontSize: 12,
              }}
            >
              <input
                type="radio"
                checked={mode === "via_bot"}
                onChange={() => setMode("via_bot")}
                style={{ marginRight: 6 }}
              />
              <strong>Crea via bot</strong> (consigliato)
              <div
                style={{
                  fontSize: 11,
                  color: "#78716c",
                  marginTop: 4,
                }}
              >
                Il bot genera un nuovo invite link gestibile via API
              </div>
            </label>
            <label
              style={{
                flex: 1,
                padding: 10,
                border: `1px solid ${mode === "from_url" ? "#3ba6f1" : "#e5e7eb"}`,
                background:
                  mode === "from_url" ? "rgba(59,166,241,0.04)" : "white",
                borderRadius: 4,
                cursor: "pointer",
                fontSize: 12,
              }}
            >
              <input
                type="radio"
                checked={mode === "from_url"}
                onChange={() => setMode("from_url")}
                style={{ marginRight: 6 }}
              />
              <strong>Incolla URL esistente</strong>
              <div
                style={{
                  fontSize: 11,
                  color: "#78716c",
                  marginTop: 4,
                }}
              >
                Link già creato dal proprietario del canale
              </div>
            </label>
          </div>
        </div>

        {mode === "from_url" && (
          <div style={{ marginBottom: 14 }}>
            <Label>Invite link</Label>
            <Input
              type="url"
              placeholder="https://t.me/+abc123..."
              value={inviteUrl}
              onChange={(e) => setInviteUrl(e.target.value)}
            />
          </div>
        )}

        <div style={{ marginBottom: 14 }}>
          <Label>Promoter</Label>
          <Select
            value={promoterId}
            onChange={(e) => setPromoterId(e.target.value)}
            disabled={loadingPromoters}
          >
            <option value="">— nessuno (non assegnato) —</option>
            {promoters.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
            <option value="__new__">+ Crea nuovo promoter</option>
          </Select>
          {promoterId === "__new__" && (
            <Input
              placeholder="Nome del nuovo promoter (es. Marco · IG bio)"
              value={newPromoterName}
              onChange={(e) => setNewPromoterName(e.target.value)}
              style={{ marginTop: 6 }}
            />
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 10, marginBottom: 14 }}>
          <div>
            <Label>Label (opzionale)</Label>
            <Input
              placeholder="es. Marco · IG bio"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>
          <div>
            <Label>Target join</Label>
            <Input
              type="number"
              min={1}
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            />
          </div>
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
          <Btn variant="primary" onClick={submit} disabled={saving}>
            {saving ? "Creazione..." : "Crea link"}
          </Btn>
        </div>
      </Modal>
    </>
  );
}
