import Link from "next/link";
import {
  listChannels,
  getChannel,
  refreshLiveMemberCount,
  listTrackingLinksForChannel,
  getChannelKpis,
  getTrackingLinkDetail,
  getDailyBreakdown,
  type TrackingLinkRow,
  type Channel,
  type ChannelKpis,
  type TrackingLinkDetail,
  type DailyBreakdownRow,
} from "@/lib/telegram-queries";
import { CopyButton } from "./copy-button";
import { AddChannelDialog } from "./add-channel-dialog";
import { CreateLinkDialog } from "./create-link-dialog";
import { EditLinkDialog } from "./edit-link-dialog";
import { EditPromoterDialog } from "./edit-promoter-dialog";
import { SyncButton } from "./sync-button";
import { Sparkline } from "./sparkline";
import { Heatmap } from "./heatmap";
import { AutoRefresh } from "./auto-refresh";
import { LastUpdated } from "./last-updated";

const BOT_USERNAME = "babysujanbot";
const POLL_INTERVAL_MS = 10_000;

export const dynamic = "force-dynamic";

export default async function TelegramPage({
  searchParams,
}: {
  searchParams: Promise<{ chat?: string; link?: string }>;
}) {
  const params = await searchParams;
  const channels = await listChannels();

  if (channels.length === 0) {
    return <EmptyState />;
  }

  const selectedChatId = params.chat
    ? Number(params.chat)
    : channels[0].chat_id;
  const channel = await getChannel(selectedChatId);
  if (!channel) return <EmptyState />;

  const [memberCountLive, links, kpis] = await Promise.all([
    refreshLiveMemberCount(selectedChatId),
    listTrackingLinksForChannel(selectedChatId),
    getChannelKpis(selectedChatId),
  ]);
  kpis.total_member_count_live = memberCountLive;

  const selectedLinkId =
    params.link ?? (links.length > 0 ? links[0].id : null);
  const [detail, dailyRows] = selectedLinkId
    ? await Promise.all([
        getTrackingLinkDetail(selectedLinkId),
        getDailyBreakdown(selectedLinkId, 30),
      ])
    : [null, []];

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "240px 1fr",
        gap: 20,
      }}
    >
      <AutoRefresh intervalMs={POLL_INTERVAL_MS} />
      <Sidebar
        channels={channels}
        activeChatId={selectedChatId}
        activeLinkId={selectedLinkId}
      />
      <main style={{ minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            marginBottom: 8,
          }}
        >
          <LastUpdated at={new Date().toISOString()} />
        </div>
        <ChannelHeader channel={channel} />
        <ChannelKpiStrip channel={channel} kpis={kpis} />
        <TrackingLinksTable
          links={links}
          activeLinkId={selectedLinkId}
          activeChatId={selectedChatId}
          totalChannelJoins={kpis.total_joins_tracked_all_time}
          orphanCount={kpis.orphan_joins_total}
        />
        {detail && (
          <LinkDetail
            detail={detail}
            allLinks={links}
            channelTotalJoins={
              kpis.total_joins_tracked_all_time + kpis.orphan_joins_total
            }
            dailyRows={dailyRows}
          />
        )}
      </main>
    </div>
  );
}

// ---------- Sidebar ----------

function Sidebar({
  channels,
  activeChatId,
  activeLinkId,
}: {
  channels: Channel[];
  activeChatId: number;
  activeLinkId: string | null;
}) {
  return (
    <aside
      style={{
        background: "white",
        border: "1px solid #e5e7eb",
        borderRadius: 8,
        padding: 12,
        height: "fit-content",
        position: "sticky",
        top: 16,
      }}
    >
      <div
        style={{
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          color: "#78716c",
          fontWeight: 500,
          margin: "4px 8px 10px",
        }}
      >
        Canali
      </div>
      {channels.map((c) => {
        const active = c.chat_id === activeChatId;
        const linkHref = activeLinkId
          ? `/telegram?chat=${c.chat_id}&link=${activeLinkId}`
          : `/telegram?chat=${c.chat_id}`;
        return (
          <Link
            key={c.chat_id}
            href={linkHref}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 8px",
              borderRadius: 6,
              marginBottom: 2,
              border: active
                ? "1px solid rgba(59,166,241,0.25)"
                : "1px solid transparent",
              background: active ? "rgba(59,166,241,0.08)" : "transparent",
              textDecoration: "none",
              color: "#0c0a09",
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 17,
                background: "linear-gradient(135deg, #f59e0b, #ec4899)",
                color: "white",
                flexShrink: 0,
              }}
            >
              💎
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {(c.title || "Canale").replace(/[\u{1F300}-\u{1FAFF}]/gu, "").trim() ||
                  "Canale"}
              </div>
              <div style={{ fontSize: 11, color: "#a8a29e", marginTop: 2 }}>
                {c.member_count != null
                  ? `${c.member_count.toLocaleString()} iscritti`
                  : "—"}
              </div>
            </div>
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "#16a34a",
              }}
              title="webhook attivo"
            />
          </Link>
        );
      })}
      <AddChannelDialog botUsername={BOT_USERNAME} />
      <div
        style={{
          marginTop: 14,
          paddingTop: 10,
          borderTop: "1px solid #f0efed",
          fontSize: 11,
          color: "#a8a29e",
        }}
      >
        Il bot dev'essere <strong style={{ color: "#78716c" }}>admin</strong>{" "}
        del canale per ricevere eventi join.
      </div>
    </aside>
  );
}

// ---------- Channel header ----------

function ChannelHeader({ channel }: { channel: Channel }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        marginBottom: 16,
        gap: 16,
        flexWrap: "wrap",
      }}
    >
      <div>
        <h1
          style={{
            fontSize: 22,
            fontWeight: 600,
            margin: 0,
            letterSpacing: "-0.01em",
          }}
        >
          {channel.title || "Canale Telegram"}
        </h1>
        <div
          style={{
            fontSize: 12,
            color: "#78716c",
            marginTop: 4,
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          }}
        >
          chat_id: {channel.chat_id}
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
          <Tag green>webhook attivo</Tag>
          <Tag>bot admin: @{BOT_USERNAME}</Tag>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <SyncButton chatId={channel.chat_id} />
        <CreateLinkDialog chatId={channel.chat_id} buttonStyle="primary" />
      </div>
    </div>
  );
}

function Tag({
  children,
  green,
}: {
  children: React.ReactNode;
  green?: boolean;
}) {
  return (
    <span
      style={{
        fontSize: 10,
        padding: "2px 8px",
        borderRadius: 999,
        background: green ? "rgba(34,197,94,0.12)" : "#f0efed",
        color: green ? "#15803d" : "#78716c",
      }}
    >
      {children}
    </span>
  );
}

// ---------- Channel KPI strip ----------

function ChannelKpiStrip({
  channel,
  kpis,
}: {
  channel: Channel;
  kpis: ChannelKpis;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(5, 1fr)",
        gap: 12,
        marginBottom: 18,
      }}
    >
      <KpiCard
        label="Iscritti totali (live)"
        value={
          kpis.total_member_count_live != null
            ? kpis.total_member_count_live.toLocaleString()
            : channel.member_count?.toLocaleString() ?? "—"
        }
        sub={
          kpis.total_member_count_live != null
            ? "Bot API · ora"
            : "non disponibile"
        }
      />
      <KpiCard
        label="Join tracciati (totali)"
        value={kpis.total_joins_tracked_all_time.toLocaleString()}
        sub={`+${kpis.total_joins_7d} ultimi 7g`}
      />
      <KpiCard
        label="% Premium"
        value={`${kpis.premium_pct_overall.toFixed(1)}%`}
        sub="media canale"
      />
      <KpiCard
        label="Top lingua"
        value={kpis.top_language ? kpis.top_language.toUpperCase() : "—"}
        sub="iscritti di questo canale"
      />
      <KpiCard
        label="Tracking link attivi"
        value={String(kpis.tracking_links_active)}
        sub={`${kpis.orphan_joins_total} join orfani (link non assegnato)`}
      />
    </div>
  );
}

function KpiCard({
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
        padding: 14,
      }}
    >
      <div style={{ fontSize: 11, color: "#78716c", marginBottom: 4 }}>
        {label}
      </div>
      <div
        style={{
          fontSize: 20,
          fontWeight: 600,
          letterSpacing: "-0.01em",
        }}
      >
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 11, color: "#a8a29e", marginTop: 3 }}>
          {sub}
        </div>
      )}
    </div>
  );
}

// ---------- Tracking links table ----------

function TrackingLinksTable({
  links,
  activeLinkId,
  activeChatId,
  totalChannelJoins,
  orphanCount,
}: {
  links: TrackingLinkRow[];
  activeLinkId: string | null;
  activeChatId: number;
  totalChannelJoins: number;
  orphanCount: number;
}) {
  const totalForQuota = totalChannelJoins + orphanCount;

  return (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          margin: "8px 0 10px",
        }}
      >
        <h2
          style={{
            fontSize: 14,
            fontWeight: 600,
            margin: 0,
            letterSpacing: "-0.005em",
          }}
        >
          Tracking link del canale
        </h2>
        <span style={{ fontSize: 11, color: "#a8a29e" }}>
          clic su una riga per il dettaglio
        </span>
      </div>
      <div
        style={{
          background: "white",
          border: "1px solid #e5e7eb",
          borderRadius: 8,
          overflow: "hidden",
          marginBottom: 18,
        }}
      >
        <table
          style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}
        >
          <thead>
            <tr style={{ background: "#fafaf9" }}>
              <Th>Promoter / Link</Th>
              <Th>Join totali</Th>
              <Th>Quota canale</Th>
              <Th>Join 7d</Th>
              <Th>% Premium</Th>
              <Th>Progress vs target</Th>
            </tr>
          </thead>
          <tbody>
            {links.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  style={{
                    padding: 16,
                    textAlign: "center",
                    color: "#a8a29e",
                  }}
                >
                  Nessun tracking link configurato.
                </td>
              </tr>
            )}
            {links.map((l) => {
              const active = l.id === activeLinkId;
              const progress = Math.min(
                100,
                (l.total_joins / Math.max(1, l.target_joins)) * 100,
              );
              const quota =
                totalForQuota > 0
                  ? (l.total_joins / totalForQuota) * 100
                  : 0;
              return (
                <tr
                  key={l.id}
                  style={{
                    background: active ? "rgba(59,166,241,0.04)" : "white",
                    boxShadow: active
                      ? "inset 3px 0 0 #3ba6f1"
                      : "none",
                    borderTop: "1px solid #f0efed",
                  }}
                >
                  <Td>
                    <Link
                      href={`/telegram?chat=${activeChatId}&link=${l.id}`}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        textDecoration: "none",
                        color: "inherit",
                      }}
                    >
                      <div
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: "50%",
                          background:
                            "linear-gradient(135deg, #3ba6f1, #5d7af2)",
                          color: "white",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 13,
                          fontWeight: 500,
                          flexShrink: 0,
                        }}
                      >
                        {(l.promoter_name || l.label || "?")
                          .charAt(0)
                          .toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 500 }}>
                          {l.promoter_name || l.label || "Link"}
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            color: "#a8a29e",
                            marginTop: 1,
                            fontFamily:
                              "ui-monospace, SFMono-Regular, Menlo, monospace",
                          }}
                        >
                          {l.invite_link.replace("https://t.me/", "t.me/")}
                        </div>
                      </div>
                    </Link>
                  </Td>
                  <Td style={{ fontWeight: 500 }}>
                    {l.total_joins.toLocaleString()}
                  </Td>
                  <Td>{quota.toFixed(1)}%</Td>
                  <Td>
                    <span style={{ color: "#16a34a", fontWeight: 500 }}>
                      +{l.joins_7d}
                    </span>
                  </Td>
                  <Td>{l.premium_pct.toFixed(1)}%</Td>
                  <Td style={{ minWidth: 180 }}>
                    <div
                      style={{
                        height: 6,
                        background: "#f0efed",
                        borderRadius: 3,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          height: "100%",
                          width: `${progress}%`,
                          background:
                            "linear-gradient(90deg, #3ba6f1, #5d7af2)",
                          borderRadius: 3,
                        }}
                      />
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: "#78716c",
                        marginTop: 4,
                      }}
                    >
                      {l.total_joins.toLocaleString()} /{" "}
                      {l.target_joins.toLocaleString()} ·{" "}
                      {progress.toFixed(1)}%
                    </div>
                  </Td>
                </tr>
              );
            })}
            {orphanCount > 0 && (
              <tr
                style={{
                  borderTop: "1px solid #f0efed",
                  background: "#fafaf9",
                }}
              >
                <Td>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        background: "#d6d3d1",
                        color: "#44403c",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 13,
                      }}
                    >
                      ?
                    </div>
                    <div>
                      <div style={{ fontWeight: 500 }}>
                        Senza tracking link
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: "#a8a29e",
                          marginTop: 1,
                        }}
                      >
                        join arrivati via invite link non assegnati
                      </div>
                    </div>
                  </div>
                </Td>
                <Td style={{ fontWeight: 500 }}>
                  {orphanCount.toLocaleString()}
                </Td>
                <Td>
                  {totalForQuota > 0
                    ? ((orphanCount / totalForQuota) * 100).toFixed(1)
                    : "0.0"}
                  %
                </Td>
                <Td>—</Td>
                <Td>—</Td>
                <Td>
                  <Tag>orfani</Tag>
                </Td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      style={{
        textAlign: "left",
        fontWeight: 500,
        color: "#78716c",
        padding: "10px 14px",
        borderBottom: "1px solid #e5e7eb",
        fontSize: 11,
        textTransform: "uppercase",
        letterSpacing: "0.04em",
      }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <td
      style={{
        padding: "12px 14px",
        verticalAlign: "middle",
        ...style,
      }}
    >
      {children}
    </td>
  );
}

// ---------- Link detail (selected) ----------

function LinkDetail({
  detail,
  allLinks,
  channelTotalJoins,
  dailyRows,
}: {
  detail: TrackingLinkDetail;
  allLinks: TrackingLinkRow[];
  channelTotalJoins: number;
  dailyRows: DailyBreakdownRow[];
}) {
  const { link } = detail;
  const target = link.target_joins;
  const current = detail.total_joins;
  const percent = target > 0 ? Math.min(100, (current / target) * 100) : 0;
  const remaining = Math.max(0, target - current);

  // ETA: based on 7-day pace (best simple model). Hide if pace = 0.
  const pacePerDay = detail.joins_7d / 7;
  const etaDays =
    pacePerDay > 0 && remaining > 0 ? Math.ceil(remaining / pacePerDay) : null;

  // Quota: this link's joins divided by all joins in the channel (tracked + orphan)
  const quota =
    channelTotalJoins > 0 ? (current / channelTotalJoins) * 100 : 0;

  // Rank: position in allLinks sorted by total_joins desc
  const sorted = [...allLinks].sort((a, b) => b.total_joins - a.total_joins);
  const rank = sorted.findIndex((l) => l.id === link.id) + 1;

  // Quality grade based on premium %
  const qualityGrade = gradeFromPremiumPct(detail.premium_pct);

  // Heatmap matrix [dow 1..7][hour 0..23]
  const matrix: number[][] = Array.from({ length: 7 }, () =>
    Array(24).fill(0),
  );
  for (const cell of detail.hourly_heatmap) {
    if (cell.dow >= 1 && cell.dow <= 7) {
      matrix[cell.dow - 1][cell.hour] = cell.joins;
    }
  }

  return (
    <div
      style={{
        background: "white",
        border: "1px solid #e5e7eb",
        borderRadius: 8,
        padding: 18,
        marginBottom: 18,
      }}
    >
      {/* Detail head */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          paddingBottom: 14,
          marginBottom: 14,
          borderBottom: "1px solid #f0efed",
          flexWrap: "wrap",
          gap: 10,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 16,
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <span style={{ display: "inline-flex", alignItems: "center" }}>
              {link.promoter_name || link.label || "Tracking link"}
              {link.promoter_id && link.promoter_name && (
                <EditPromoterDialog
                  promoterId={link.promoter_id}
                  initialName={link.promoter_name}
                  initialNotes={link.promoter_notes}
                />
              )}
            </span>
            <span
              style={{
                fontSize: 10,
                background: "rgba(59,166,241,0.1)",
                color: "#3ba6f1",
                padding: "2px 8px",
                borderRadius: 999,
                fontWeight: 500,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              tracking link selezionato
            </span>
          </div>
          <div
            style={{
              fontSize: 11,
              color: "#78716c",
              marginTop: 4,
              fontFamily:
                "ui-monospace, SFMono-Regular, Menlo, monospace",
            }}
          >
            {link.invite_link}
          </div>
        </div>
        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <CopyButton text={link.invite_link} />
          <EditLinkDialog
            linkId={link.id}
            initial={{
              label: link.label,
              target_joins: link.target_joins,
              promoter_id: link.promoter_id,
              is_active: link.is_active,
            }}
          />
        </div>
      </div>

      {/* Progress */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 10,
        }}
      >
        <span style={{ fontSize: 12, color: "#78716c" }}>
          Join via questo tracking link
        </span>
        <span style={{ fontSize: 13, fontWeight: 500 }}>
          {current.toLocaleString()} / {target.toLocaleString()}{" "}
          <span style={{ color: "#78716c", fontWeight: 400 }}>
            ({percent.toFixed(1)}%)
          </span>
        </span>
      </div>
      <div
        style={{
          position: "relative",
          height: 26,
          background: "#f5f5f4",
          border: "1px solid #e5e7eb",
          borderRadius: 13,
          overflow: "hidden",
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
        <span>{Math.round(target * 0.25).toLocaleString()}</span>
        <span>{Math.round(target * 0.5).toLocaleString()}</span>
        <span>{Math.round(target * 0.75).toLocaleString()}</span>
        <span>{target.toLocaleString()}</span>
      </div>
      <div style={{ marginTop: 10, fontSize: 12, color: "#78716c" }}>
        {remaining === 0 ? (
          <span style={{ color: "#16a34a", fontWeight: 500 }}>
            Obiettivo raggiunto.
          </span>
        ) : (
          <>
            Mancano <strong>{remaining.toLocaleString()} join</strong> ·{" "}
            {pacePerDay > 0 ? (
              <>
                pace 7d:{" "}
                <strong>+{pacePerDay.toFixed(1)} join/giorno</strong>
                {etaDays != null && (
                  <>
                    {" "}
                    · ETA: <strong>{etaDays} giorni</strong>
                  </>
                )}
              </>
            ) : (
              <em>nessun join recente — pace non calcolabile</em>
            )}
          </>
        )}
      </div>

      {/* Sub KPIs */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 12,
          marginTop: 14,
        }}
      >
        <SubKpi label="Join totali" value={current.toLocaleString()} />
        <SubKpi
          label="Join 7d"
          value={detail.joins_7d.toLocaleString()}
          sub={`${detail.joins_30d.toLocaleString()} ultimi 30g`}
        />
        <SubKpi
          label="% Premium"
          value={`${detail.premium_pct.toFixed(1)}%`}
          sub={`${detail.premium_count.toLocaleString()} premium`}
        />
        <SubKpi
          label="Top lingua"
          value={
            detail.language_breakdown[0]
              ? `${detail.language_breakdown[0].language?.toUpperCase() || "—"} ${detail.language_breakdown[0].pct.toFixed(0)}%`
              : "—"
          }
          sub={detail.language_breakdown
            .slice(1, 3)
            .map(
              (l) =>
                `${l.language?.toUpperCase() || "—"} ${l.pct.toFixed(0)}%`,
            )
            .join(" · ")}
        />
      </div>

      {/* Chart + Heatmap */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.3fr 1fr",
          gap: 14,
          marginTop: 14,
        }}
      >
        <Panel
          title="Join giornalieri · ultimi 30 giorni"
          hint="passa il mouse per il dettaglio"
        >
          <Sparkline points={detail.joins_per_day_30d} />
          <div
            style={{
              marginTop: 4,
              fontSize: 10,
              color: "#a8a29e",
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <span>{detail.joins_per_day_30d[0]?.day || ""}</span>
            <span>
              {detail.joins_per_day_30d[14]?.day || ""}
            </span>
            <span>
              {
                detail.joins_per_day_30d[
                  detail.joins_per_day_30d.length - 1
                ]?.day
              }
            </span>
          </div>
        </Panel>
        <Panel
          title="Heatmap orari join"
          hint="UTC · passa il mouse sulle celle"
        >
          <Heatmap matrix={matrix} />
        </Panel>
      </div>

      {/* Ecosystem impact */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 12,
          marginTop: 14,
        }}
      >
        <ImpactCard
          highlight
          label={`Quota di ${link.promoter_name || "questo link"} sul canale`}
          big={`${quota.toFixed(1)}%`}
          hint={`${current.toLocaleString()} su ${channelTotalJoins.toLocaleString()} join totali`}
        />
        <ImpactCard
          label="Rank tra i tracking link"
          big={
            allLinks.length > 0
              ? `#${rank} di ${allLinks.length}`
              : "—"
          }
          hint={
            sorted[0] && sorted[0].id !== link.id
              ? `prima: ${sorted[0].promoter_name || sorted[0].label || "—"} (${sorted[0].total_joins})`
              : "leader del canale"
          }
        />
        <ImpactCard
          label="Qualità audience portata"
          big={qualityGrade.label}
          hint={qualityGrade.hint(detail.premium_pct)}
        />
      </div>

      {/* Daily breakdown */}
      <DailyBreakdown rows={dailyRows} />

      {/* Recent joins */}
      <div style={{ marginTop: 18 }}>
        <h3
          style={{
            fontSize: 12,
            fontWeight: 600,
            margin: "0 0 8px",
          }}
        >
          Ultimi join via questo link
        </h3>
        {detail.recent_joins.length === 0 ? (
          <div
            style={{
              padding: 16,
              fontSize: 12,
              color: "#a8a29e",
              textAlign: "center",
              background: "#fafaf9",
              border: "1px solid #f0efed",
              borderRadius: 6,
            }}
          >
            Nessun join via questo link finora. Quando qualcuno entra via{" "}
            <span style={{ fontFamily: "monospace" }}>{link.invite_link}</span>{" "}
            comparirà qui in tempo reale.
          </div>
        ) : (
          <table
            style={{
              width: "100%",
              fontSize: 12,
              borderCollapse: "collapse",
            }}
          >
            <thead>
              <tr style={{ color: "#78716c" }}>
                <Th>Quando</Th>
                <Th>Utente</Th>
                <Th>Lingua</Th>
                <Th>Premium</Th>
                <Th>ID Telegram</Th>
              </tr>
            </thead>
            <tbody>
              {detail.recent_joins.map((j, i) => (
                <tr
                  key={i}
                  style={{ borderBottom: "1px solid #f0efed" }}
                >
                  <Td>{new Date(j.ts).toLocaleString("it-IT")}</Td>
                  <Td>
                    {j.username ? `@${j.username}` : j.first_name || "—"}
                  </Td>
                  <Td>{j.language?.toUpperCase() || "—"}</Td>
                  <Td>
                    {j.is_premium ? (
                      <span
                        style={{
                          background: "rgba(245,158,11,0.12)",
                          color: "#d97706",
                          fontSize: 10,
                          padding: "1px 7px",
                          borderRadius: 999,
                          fontWeight: 500,
                        }}
                      >
                        premium
                      </span>
                    ) : (
                      "—"
                    )}
                  </Td>
                  <Td
                    style={{
                      fontFamily:
                        "ui-monospace, SFMono-Regular, Menlo, monospace",
                      fontSize: 11,
                      color: "#78716c",
                    }}
                  >
                    {j.telegram_user_id}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ---------- small components ----------

function SubKpi({
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
        background: "#fafaf9",
        border: "1px solid #e5e7eb",
        borderRadius: 6,
        padding: 12,
      }}
    >
      <div style={{ fontSize: 11, color: "#78716c", marginBottom: 3 }}>
        {label}
      </div>
      <div style={{ fontSize: 17, fontWeight: 600 }}>{value}</div>
      {sub && (
        <div style={{ fontSize: 11, color: "#a8a29e", marginTop: 2 }}>
          {sub}
        </div>
      )}
    </div>
  );
}

function Panel({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: "#fafaf9",
        border: "1px solid #e5e7eb",
        borderRadius: 6,
        padding: "12px 14px",
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 600,
          marginBottom: 8,
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <span>{title}</span>
        {hint && (
          <span style={{ fontSize: 10, color: "#a8a29e", fontWeight: 400 }}>
            {hint}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function ImpactCard({
  label,
  big,
  hint,
  highlight,
}: {
  label: string;
  big: string;
  hint: string;
  highlight?: boolean;
}) {
  return (
    <div
      style={{
        padding: 12,
        background: highlight ? "rgba(59,166,241,0.06)" : "#fafaf9",
        border: `1px solid ${highlight ? "rgba(59,166,241,0.25)" : "#e5e7eb"}`,
        borderRadius: 6,
      }}
    >
      <div style={{ fontSize: 11, color: "#78716c", marginBottom: 3 }}>
        {label}
      </div>
      <div style={{ fontSize: 17, fontWeight: 600 }}>{big}</div>
      <div style={{ fontSize: 11, color: "#a8a29e", marginTop: 2 }}>{hint}</div>
    </div>
  );
}

function gradeFromPremiumPct(pct: number): {
  label: string;
  hint: (p: number) => string;
} {
  if (pct >= 30)
    return {
      label: "A",
      hint: (p) => `${p.toFixed(1)}% premium · audience top-tier`,
    };
  if (pct >= 20)
    return {
      label: "A-",
      hint: (p) => `${p.toFixed(1)}% premium · sopra la media`,
    };
  if (pct >= 12)
    return {
      label: "B",
      hint: (p) => `${p.toFixed(1)}% premium · in media`,
    };
  if (pct >= 5)
    return {
      label: "C",
      hint: (p) => `${p.toFixed(1)}% premium · sotto la media`,
    };
  return {
    label: "D",
    hint: (p) =>
      p > 0
        ? `${p.toFixed(1)}% premium · molto bassa`
        : "ancora pochi dati",
  };
}

function DailyBreakdown({ rows }: { rows: DailyBreakdownRow[] }) {
  // Show most recent day first
  const sorted = [...rows].sort((a, b) => b.day.localeCompare(a.day));
  const nonZeroCount = sorted.filter((r) => r.joins > 0).length;
  const total = sorted.reduce((acc, r) => acc + r.joins, 0);

  return (
    <div style={{ marginTop: 18 }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: 8,
        }}
      >
        <h3 style={{ fontSize: 12, fontWeight: 600, margin: 0 }}>
          Breakdown giornaliero
        </h3>
        <span style={{ fontSize: 11, color: "#a8a29e" }}>
          ultimi 30 giorni · {total} join in {nonZeroCount} giorni con
          attività
        </span>
      </div>
      <div
        style={{
          background: "#fafaf9",
          border: "1px solid #e5e7eb",
          borderRadius: 6,
          overflow: "hidden",
          maxHeight: 380,
          overflowY: "auto",
        }}
      >
        <table
          style={{
            width: "100%",
            fontSize: 12,
            borderCollapse: "collapse",
          }}
        >
          <thead
            style={{
              position: "sticky",
              top: 0,
              background: "#fafaf9",
              zIndex: 1,
            }}
          >
            <tr style={{ color: "#78716c" }}>
              <th
                style={{
                  textAlign: "left",
                  fontWeight: 500,
                  padding: "8px 12px",
                  borderBottom: "1px solid #e5e7eb",
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                Giorno
              </th>
              <th
                style={{
                  textAlign: "right",
                  fontWeight: 500,
                  padding: "8px 12px",
                  borderBottom: "1px solid #e5e7eb",
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                Join
              </th>
              <th
                style={{
                  textAlign: "right",
                  fontWeight: 500,
                  padding: "8px 12px",
                  borderBottom: "1px solid #e5e7eb",
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                Premium
              </th>
              <th
                style={{
                  textAlign: "right",
                  fontWeight: 500,
                  padding: "8px 12px",
                  borderBottom: "1px solid #e5e7eb",
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                % Premium
              </th>
              <th
                style={{
                  textAlign: "left",
                  fontWeight: 500,
                  padding: "8px 12px",
                  borderBottom: "1px solid #e5e7eb",
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                Top lingua
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => {
              const isToday = r.day === new Date().toISOString().slice(0, 10);
              return (
                <tr
                  key={r.day}
                  style={{
                    borderBottom: "1px solid #f0efed",
                    background: isToday ? "rgba(59,166,241,0.04)" : "white",
                  }}
                >
                  <td
                    style={{
                      padding: "7px 12px",
                      fontFamily:
                        "ui-monospace, SFMono-Regular, Menlo, monospace",
                      fontSize: 11,
                      color: r.joins > 0 ? "#0c0a09" : "#a8a29e",
                    }}
                  >
                    {r.day}
                    {isToday && (
                      <span
                        style={{
                          marginLeft: 6,
                          fontSize: 9,
                          color: "#3ba6f1",
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                        }}
                      >
                        oggi
                      </span>
                    )}
                  </td>
                  <td
                    style={{
                      padding: "7px 12px",
                      textAlign: "right",
                      fontWeight: r.joins > 0 ? 500 : 400,
                      color: r.joins > 0 ? "#0c0a09" : "#a8a29e",
                    }}
                  >
                    {r.joins}
                  </td>
                  <td
                    style={{
                      padding: "7px 12px",
                      textAlign: "right",
                      color: r.premium > 0 ? "#0c0a09" : "#a8a29e",
                    }}
                  >
                    {r.premium}
                  </td>
                  <td
                    style={{
                      padding: "7px 12px",
                      textAlign: "right",
                      color: r.joins > 0 ? "#0c0a09" : "#a8a29e",
                    }}
                  >
                    {r.joins > 0 ? `${r.premium_pct.toFixed(0)}%` : "—"}
                  </td>
                  <td
                    style={{
                      padding: "7px 12px",
                      color: r.top_language ? "#0c0a09" : "#a8a29e",
                    }}
                  >
                    {r.top_language?.toUpperCase() || "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div
      style={{
        padding: 32,
        textAlign: "center",
        color: "#78716c",
      }}
    >
      <h2 style={{ fontSize: 18, fontWeight: 600 }}>
        Nessun canale Telegram configurato.
      </h2>
      <p style={{ fontSize: 13, marginTop: 8 }}>
        Aggiungi @babysujanbot come admin del tuo canale; comparirà qui
        automaticamente al primo evento.
      </p>
    </div>
  );
}
