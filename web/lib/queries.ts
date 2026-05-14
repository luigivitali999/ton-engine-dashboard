import { createAdminClient } from "@/lib/supabase/admin";
import type {
  Creator,
  LinkAggregate,
  TimeRange,
} from "@/lib/types";

function rangeBounds(range: TimeRange): { start: string; end: string } | null {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const end = today.toISOString().slice(0, 10);

  if (range === "all") return null;
  if (range === "today") return { start: end, end };

  const days = range === "7d" ? 7 : 30;
  const start = new Date(today);
  start.setUTCDate(start.getUTCDate() - days + 1);
  return { start: start.toISOString().slice(0, 10), end };
}

/** List all creators that have at least one (non-excluded) link in the system. */
export async function listCreators(): Promise<Creator[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("creators")
    .select("id, user_name, nick_name, name, tag_name, active")
    .eq("active", true)
    .order("user_name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Creator[];
}

/**
 * Per-link aggregates using cumulative values from the most recent snapshot.
 *
 * We previously summed daily deltas, but with only one snapshot in DB the
 * deltas are all NULL and everything appeared as zero. Using the latest
 * snapshot's cumulative values surfaces real numbers (clicks, subs, revenue)
 * even on the first day. Once we accumulate multiple snapshots, range-aware
 * delta aggregation can be reintroduced as a separate code path.
 */
export async function fetchLinkAggregates(
  creatorIds: string[] | null,
  _range: TimeRange,
  includeExcluded = false,
): Promise<LinkAggregate[]> {
  const supabase = createAdminClient();

  // Latest snapshot date globally
  const { data: latest, error: latestErr } = await supabase
    .from("links_daily")
    .select("snapshot_date")
    .order("snapshot_date", { ascending: false })
    .limit(1);
  if (latestErr) throw latestErr;
  if (!latest || latest.length === 0) return [];
  const latestDate = latest[0].snapshot_date as string;

  // Link master rows
  let linksQ = supabase
    .from("links")
    .select("id, name, creator_id, link_type, excluded");
  if (!includeExcluded) linksQ = linksQ.eq("excluded", false);
  if (creatorIds && creatorIds.length > 0) {
    linksQ = linksQ.in("creator_id", creatorIds);
  }
  const { data: linkRows, error: linkErr } = await linksQ;
  if (linkErr) throw linkErr;
  if (!linkRows || linkRows.length === 0) return [];

  const linkIds = linkRows.map((l) => l.id as string);

  // Latest snapshot row per link
  const { data: snapshotRows, error: snapshotErr } = await supabase
    .from("links_daily")
    .select(
      "link_id, sub_count, paying_fans_count, earnings_gross, earnings_net, click_count, subscription_cvr, spend_claim, aeps_net",
    )
    .eq("snapshot_date", latestDate)
    .in("link_id", linkIds);
  if (snapshotErr) throw snapshotErr;
  const snapshotByLink = new Map(
    (snapshotRows ?? []).map((s) => [s.link_id as string, s]),
  );

  // Creator names
  const creatorIdsNeeded = Array.from(
    new Set(linkRows.map((r) => r.creator_id as string)),
  );
  const { data: creatorRows, error: cErr } = await supabase
    .from("creators")
    .select("id, user_name, nick_name, name")
    .in("id", creatorIdsNeeded);
  if (cErr) throw cErr;
  const creatorById = new Map(
    (creatorRows ?? []).map((c) => [
      c.id as string,
      (c.user_name || c.nick_name || c.name || "unknown") as string,
    ]),
  );

  const result: LinkAggregate[] = linkRows.map((l) => {
    const s = snapshotByLink.get(l.id as string);
    const clicks = s?.click_count ?? null;
    const linkType = l.link_type as "TRIAL" | "TRACKING";
    // Infloww uses a different conversion field per link type:
    // - TRACKING: subscription_cvr (click → sub)
    // - TRIAL:    spend_claim       (trial → paid)
    const cvrRaw =
      linkType === "TRIAL"
        ? (s?.spend_claim as string | null | undefined)
        : (s?.subscription_cvr as string | null | undefined);
    return {
      link_id: l.id as string,
      link_name: (l.name as string) || "(no name)",
      link_type: linkType,
      creator_id: l.creator_id as string,
      creator_name: creatorById.get(l.creator_id as string) ?? "unknown",
      subs: (s?.sub_count as number) ?? 0,
      paying_fans: (s?.paying_fans_count as number) ?? 0,
      earnings_gross: parseFloat((s?.earnings_gross as string) ?? "0"),
      earnings_net: parseFloat((s?.earnings_net as string) ?? "0"),
      clicks: typeof clicks === "number" ? clicks : null,
      cvr: cvrRaw != null && cvrRaw !== "" ? parseFloat(cvrRaw) : null,
      arpu: s?.aeps_net ? parseFloat(s.aeps_net as string) : null,
      excluded: l.excluded as boolean,
    };
  });

  result.sort((a, b) => b.earnings_net - a.earnings_net);
  return result;
}

/** How many links are currently excluded (for the "Show excluded (N)" toggle). */
export async function countExcludedLinks(): Promise<number> {
  const supabase = createAdminClient();
  const { count, error } = await supabase
    .from("links")
    .select("id", { count: "exact", head: true })
    .eq("excluded", true);
  if (error) throw error;
  return count ?? 0;
}

/**
 * Daily time series aggregated across all (non-excluded) links matching the filter.
 * Useful once we have ≥2 snapshots — until then returns rows with all-zero deltas
 * which the chart UI gracefully handles.
 */
export interface TimeSeriesPoint {
  date: string;
  subs: number;
  revenue_net: number;
  revenue_gross: number;
  clicks: number;
  is_real: boolean;
}

export async function fetchDailyTimeSeries(
  creatorIds: string[] | null,
  range: TimeRange,
): Promise<TimeSeriesPoint[]> {
  const supabase = createAdminClient();
  const bounds = rangeBounds(range);

  // Hybrid view: real cumulative values where snapshots exist, linear synthetic
  // fallback elsewhere. As we accumulate snapshots day after day, more days
  // become real automatically — no manual switch.
  let q = supabase
    .from("v_daily_cumulative_hybrid")
    .select(
      "snapshot_date, creator_id, sub_count, paying_fans_count, earnings_net, earnings_gross, click_count, is_real",
    )
    .eq("excluded", false);

  if (creatorIds && creatorIds.length > 0) {
    q = q.in("creator_id", creatorIds);
  }
  if (bounds) {
    q = q.gte("snapshot_date", bounds.start).lte("snapshot_date", bounds.end);
  } else {
    const cap = new Date();
    cap.setUTCDate(cap.getUTCDate() - 365);
    q = q.gte("snapshot_date", cap.toISOString().slice(0, 10));
  }

  const { data, error } = await q;
  if (error) throw error;

  // Aggregate by date. Each row is a (link, day) cumulative value — sum across
  // links to get the network cumulative for that day. Daily "delta" is then
  // computed by the chart from consecutive days' cumulatives.
  const byDate = new Map<
    string,
    { date: string; cum_subs: number; cum_net: number; cum_gross: number; cum_clicks: number; real_count: number; total_count: number }
  >();
  for (const row of data ?? []) {
    const r = row as {
      snapshot_date: string;
      sub_count: number | string | null;
      paying_fans_count: number | string | null;
      earnings_net: number | string | null;
      earnings_gross: number | string | null;
      click_count: number | string | null;
      is_real: boolean;
    };
    const point = byDate.get(r.snapshot_date) ?? {
      date: r.snapshot_date,
      cum_subs: 0,
      cum_net: 0,
      cum_gross: 0,
      cum_clicks: 0,
      real_count: 0,
      total_count: 0,
    };
    point.cum_subs += parseFloat(String(r.sub_count ?? "0"));
    point.cum_net += parseFloat(String(r.earnings_net ?? "0"));
    point.cum_gross += parseFloat(String(r.earnings_gross ?? "0"));
    point.cum_clicks += parseFloat(String(r.click_count ?? "0"));
    point.total_count += 1;
    if (r.is_real) point.real_count += 1;
    byDate.set(r.snapshot_date, point);
  }

  // Convert cumulatives to daily deltas (what TimeSeriesPoint expects).
  // The chart's CandleView and GrowthView accumulate these back into a
  // cumulative line — so we round-trip cumulative -> delta -> cumulative.
  // The benefit: any consumer that wants daily deltas can read TimeSeriesPoint
  // directly, while the rendering path still gets the cumulative shape.
  const sorted = Array.from(byDate.values()).sort((a, b) =>
    a.date.localeCompare(b.date),
  );

  const out: TimeSeriesPoint[] = [];
  let prevSubs = 0;
  let prevNet = 0;
  let prevGross = 0;
  let prevClicks = 0;
  for (const p of sorted) {
    out.push({
      date: p.date,
      subs: p.cum_subs - prevSubs,
      revenue_net: p.cum_net - prevNet,
      revenue_gross: p.cum_gross - prevGross,
      clicks: p.cum_clicks - prevClicks,
      // Mark a day as "real" if a meaningful share of its links has a real snapshot.
      // We treat ≥80% as real to cover edge cases where 1-2 links lost an ingest.
      is_real: p.total_count > 0 && p.real_count / p.total_count >= 0.8,
    });
    prevSubs = p.cum_subs;
    prevNet = p.cum_net;
    prevGross = p.cum_gross;
    prevClicks = p.cum_clicks;
  }
  return out;
}
