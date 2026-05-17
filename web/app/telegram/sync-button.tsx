"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SyncButton({ chatId }: { chatId: number }) {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);

  async function sync() {
    setSyncing(true);
    try {
      await fetch(`/api/telegram/channels/${chatId}/sync`, {
        method: "POST",
      });
      router.refresh();
    } catch {
      // swallow — best-effort
    } finally {
      setSyncing(false);
    }
  }

  return (
    <button
      onClick={sync}
      disabled={syncing}
      style={{
        padding: "6px 14px",
        fontSize: 12,
        borderRadius: 4,
        border: "1px solid #e5e7eb",
        background: "white",
        color: "#0c0a09",
        cursor: syncing ? "default" : "pointer",
        opacity: syncing ? 0.6 : 1,
      }}
    >
      {syncing ? "Sincronizzazione..." : "Sincronizza ora"}
    </button>
  );
}
