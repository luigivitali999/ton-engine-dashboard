import { CreatorFilter } from "@/components/creator-filter";
import { TimeRangeFilter } from "@/components/time-range-filter";
import { KpiCard } from "@/components/kpi-card";
import { LinksTable } from "@/components/links-table";
import { TrendChart } from "@/components/trend-chart";
import { EfficiencyQuadrant } from "@/components/efficiency-quadrant";
import {
  countExcludedLinks,
  fetchDailyTimeSeries,
  fetchLinkAggregates,
  listCreators,
} from "@/lib/queries";
import type { TimeRange } from "@/lib/types";

export const revalidate = 0; // always fresh — data changes on user actions

const RANGE_LABELS: Record<TimeRange, string> = {
  today: "oggi",
  "7d": "ultimi 7 giorni",
  "30d": "ultimi 30 giorni",
  all: "all time",
};

function parseRange(raw: string | undefined): TimeRange {
  if (raw === "today" || raw === "7d" || raw === "30d" || raw === "all") return raw;
  return "7d";
}

function parseCreators(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function fmtUSD(n: number, opts?: { compact?: boolean }) {
  if (opts?.compact && Math.abs(n) >= 1000) {
    return `$${(n / 1000).toFixed(1)}k`;
  }
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function fmtInt(n: number) {
  return n.toLocaleString("en-US");
}

function fmtPct(n: number | null) {
  if (n === null) return "—";
  return `${n.toFixed(1)}%`;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; creators?: string; showExcluded?: string }>;
}) {
  const sp = await searchParams;
  const range = parseRange(sp.range);
  const selectedCreatorIds = parseCreators(sp.creators);
  const showExcluded = sp.showExcluded === "1";

  const [creators, links, excludedCount, timeSeries] = await Promise.all([
    listCreators(),
    fetchLinkAggregates(
      selectedCreatorIds.length > 0 ? selectedCreatorIds : null,
      range,
      showExcluded,
    ),
    countExcludedLinks(),
    fetchDailyTimeSeries(
      selectedCreatorIds.length > 0 ? selectedCreatorIds : null,
      range,
    ),
  ]);

  // Aggregate KPIs from the link rows
  const totalSubs = links.reduce((acc, l) => acc + l.subs, 0);
  const totalNet = links.reduce((acc, l) => acc + l.earnings_net, 0);
  const totalGross = links.reduce((acc, l) => acc + l.earnings_gross, 0);
  const activeLinks = links.length;
  const trialCount = links.filter((l) => l.link_type === "TRIAL").length;
  const trackingCount = links.filter((l) => l.link_type === "TRACKING").length;

  // Conversion KPI — now CVR is unified per link type at the data layer:
  //   TRACKING.cvr = subscription_cvr (click → sub)
  //   TRIAL.cvr    = spend_claim       (trial → paid)
  // So we can simply average across all links with a non-null cvr.
  const cvrLinks = links.filter((l) => l.cvr !== null);
  const avgCvr =
    cvrLinks.length > 0
      ? cvrLinks.reduce((acc, l) => acc + (l.cvr ?? 0), 0) / cvrLinks.length
      : null;

  const cvrLabel =
    trialCount > 0 && trackingCount > 0
      ? "Avg CVR"
      : trialCount > 0
        ? "Trial → Paid"
        : "Click → Sub";

  const cvrHint =
    trialCount > 0 && trackingCount > 0
      ? `${trackingCount} tracking + ${trialCount} trial`
      : trialCount > 0
        ? `Infloww spend_claim · ${cvrLinks.length}/${links.length} link`
        : `Infloww subscription_cvr · ${cvrLinks.length}/${links.length} link`;

  // Hide "clicks" tab in chart when no tracking links visible
  const hideClicks = trackingCount === 0;

  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          marginBottom: 18,
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ fontSize: 11, color: "#78716c", marginBottom: 4 }}>
            Performance · {RANGE_LABELS[range]}
          </div>
          <h1
            style={{
              fontSize: 22,
              fontWeight: 500,
              letterSpacing: "-0.4px",
              color: "#0c0a09",
              margin: 0,
            }}
          >
            Daily performance
          </h1>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <CreatorFilter creators={creators} selectedIds={selectedCreatorIds} />
          <TimeRangeFilter active={range} />
        </div>
      </div>

      {/* KPIs */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: 10,
          marginBottom: 14,
        }}
      >
        <KpiCard
          label="New subscribers"
          value={fmtInt(totalSubs)}
          hint={`${RANGE_LABELS[range]}`}
        />
        <KpiCard
          label="Revenue net"
          value={fmtUSD(totalNet)}
          hint={`gross ${fmtUSD(totalGross, { compact: true })}`}
        />
        <KpiCard
          label="Active links"
          value={fmtInt(activeLinks)}
          hint={`${trialCount} trial · ${trackingCount} tracking`}
        />
        <KpiCard
          label={cvrLabel}
          value={fmtPct(avgCvr)}
          hint={cvrHint}
        />
      </div>

      {/* Trend chart */}
      <TrendChart
        timeSeries={timeSeries}
        hideClicks={hideClicks}
        topCreators={Array.from(
          links.reduce((acc, l) => {
            const cur = acc.get(l.creator_id) ?? {
              creator_id: l.creator_id,
              creator_name: l.creator_name,
              revenue_net: 0,
              subs: 0,
              paid_fans: 0,
              link_count: 0,
            };
            cur.revenue_net += l.earnings_net;
            cur.subs += l.subs;
            cur.paid_fans += l.paying_fans;
            cur.link_count += 1;
            acc.set(l.creator_id, cur);
            return acc;
          }, new Map<string, {
            creator_id: string;
            creator_name: string;
            revenue_net: number;
            subs: number;
            paid_fans: number;
            link_count: number;
          }>()).values(),
        )}
      />

      {/* Efficiency quadrant */}
      <EfficiencyQuadrant links={links} />

      {/* Links table */}
      <LinksTable
        rows={links}
        groupByCreator={selectedCreatorIds.length !== 1}
        excludedCount={excludedCount}
        showExcluded={showExcluded}
        currentParams={{
          range: sp.range,
          creators: sp.creators,
          showExcluded: sp.showExcluded,
        }}
      />
    </div>
  );
}
