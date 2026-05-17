import {
  getTelegramConfig,
  getClickStats,
  getJoinStats,
  getRecentJoins,
} from "@/lib/telegram-queries";
import { TargetEditor } from "./target-editor";
import { CopyLinkBox } from "./copy-link-box";

export const dynamic = "force-dynamic";

export default async function TelegramPage() {
  const config = await getTelegramConfig();
  const [clicks, joins, recent] = await Promise.all([
    getClickStats(),
    getJoinStats(config.tracked_invite_link),
    getRecentJoins(10, config.tracked_invite_link),
  ]);

  const target = config.target_joins;
  const current = joins.total_tracked;
  const percent = target > 0 ? Math.min(100, (current / target) * 100) : 0;
  const cvr = clicks.total > 0 ? (current / clicks.total) * 100 : 0;
  const remaining = Math.max(0, target - current);

  const milestones = [
    Math.round(target * 0.25),
    Math.round(target * 0.5),
    Math.round(target * 0.75),
    target,
  ];

  const shareUrl =
    "https://ton-engine-dashboard.vercel.app/r/ton";

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 4, letterSpacing: "-0.01em" }}>
        Telegram tracking
      </h1>
      <p style={{ fontSize: 13, color: "#78716c", marginBottom: 24 }}>
        Click sul link condiviso e join effettivi via link tracciato del canale.
      </p>

      {/* Progress bar (gamification centerpiece) */}
      <div
        style={{
          background: "white",
          border: "1px solid #e5e7eb",
          borderRadius: 8,
          padding: 20,
          marginBottom: 16,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: 12,
          }}
        >
          <span style={{ fontSize: 13, color: "#78716c" }}>
            Join via link tracciato
          </span>
          <span style={{ fontSize: 13, color: "#0c0a09", fontWeight: 500 }}>
            {current.toLocaleString()} / {target.toLocaleString()}{" "}
            <span style={{ color: "#78716c", fontWeight: 400 }}>
              ({percent.toFixed(1)}%)
            </span>
          </span>
        </div>
        <div
          style={{
            position: "relative",
            height: 32,
            background: "#f5f5f4",
            borderRadius: 16,
            overflow: "hidden",
            border: "1px solid #e5e7eb",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: 0,
              width: `${percent}%`,
              background: "linear-gradient(90deg, #3ba6f1, #5d7af2)",
              transition: "width 0.4s ease-out",
            }}
          />
          {[25, 50, 75].map((p) => (
            <div
              key={p}
              style={{
                position: "absolute",
                top: 0,
                bottom: 0,
                left: `${p}%`,
                width: 1,
                background: "rgba(0,0,0,0.08)",
              }}
            />
          ))}
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: 6,
            fontSize: 11,
            color: "#a8a29e",
          }}
        >
          <span>0</span>
          <span>{milestones[0].toLocaleString()}</span>
          <span>{milestones[1].toLocaleString()}</span>
          <span>{milestones[2].toLocaleString()}</span>
          <span>{milestones[3].toLocaleString()}</span>
        </div>
        <div
          style={{
            marginTop: 14,
            fontSize: 12,
            color: remaining === 0 ? "#16a34a" : "#78716c",
          }}
        >
          {remaining === 0
            ? "Obiettivo raggiunto."
            : `Mancano ${remaining.toLocaleString()} join all'obiettivo.`}
        </div>
      </div>

      {/* KPI cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <Kpi
          label="Click totali"
          value={clicks.total.toLocaleString()}
          sub={`${clicks.last_7d.toLocaleString()} ultimi 7g`}
        />
        <Kpi
          label="Join (link tracciato)"
          value={current.toLocaleString()}
          sub={`${joins.last_7d.toLocaleString()} ultimi 7g`}
        />
        <Kpi
          label="CVR click → join"
          value={`${cvr.toFixed(1)}%`}
          sub="conversione"
        />
        <Kpi
          label="Target"
          value={target.toLocaleString()}
          sub={`${percent.toFixed(1)}% completato`}
        />
      </div>

      {/* Share link + target editor */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "2fr 1fr",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <div
          style={{
            background: "white",
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            padding: 16,
          }}
        >
          <div style={{ fontSize: 12, color: "#78716c", marginBottom: 6 }}>
            Link da condividere
          </div>
          <CopyLinkBox url={shareUrl} />
          <div style={{ fontSize: 11, color: "#a8a29e", marginTop: 8 }}>
            Reindirizza al canale via{" "}
            <span style={{ fontFamily: "monospace" }}>
              {config.tracked_invite_link}
            </span>
          </div>
        </div>
        <div
          style={{
            background: "white",
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            padding: 16,
          }}
        >
          <TargetEditor initial={target} />
        </div>
      </div>

      {/* Recent joins */}
      <div
        style={{
          background: "white",
          border: "1px solid #e5e7eb",
          borderRadius: 8,
          padding: 16,
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
          Ultimi join
        </div>
        {recent.length === 0 ? (
          <div style={{ fontSize: 12, color: "#a8a29e" }}>
            Nessun join ancora registrato. Condividi il link sopra per
            cominciare.
          </div>
        ) : (
          <table
            style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}
          >
            <thead>
              <tr
                style={{
                  textAlign: "left",
                  color: "#78716c",
                  borderBottom: "1px solid #e5e7eb",
                }}
              >
                <th style={{ padding: "6px 0", fontWeight: 500 }}>Quando</th>
                <th style={{ padding: "6px 0", fontWeight: 500 }}>Utente</th>
                <th style={{ padding: "6px 0", fontWeight: 500 }}>
                  ID Telegram
                </th>
              </tr>
            </thead>
            <tbody>
              {recent.map((j, i) => (
                <tr
                  key={i}
                  style={{ borderBottom: "1px solid #f5f5f4" }}
                >
                  <td style={{ padding: "6px 0" }}>
                    {new Date(j.ts).toLocaleString("it-IT")}
                  </td>
                  <td style={{ padding: "6px 0" }}>
                    {j.username
                      ? `@${j.username}`
                      : j.first_name || "—"}
                  </td>
                  <td
                    style={{
                      padding: "6px 0",
                      fontFamily: "monospace",
                      color: "#78716c",
                    }}
                  >
                    {j.telegram_user_id}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div
      style={{
        background: "white",
        border: "1px solid #e5e7eb",
        borderRadius: 8,
        padding: 16,
      }}
    >
      <div style={{ fontSize: 11, color: "#78716c", marginBottom: 4 }}>
        {label}
      </div>
      <div
        style={{
          fontSize: 22,
          fontWeight: 600,
          color: "#0c0a09",
          letterSpacing: "-0.01em",
        }}
      >
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 11, color: "#a8a29e", marginTop: 4 }}>
          {sub}
        </div>
      )}
    </div>
  );
}
