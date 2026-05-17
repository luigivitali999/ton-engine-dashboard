import { createAdminClient } from "@/lib/supabase/admin";

// ---------- Types ----------

export interface Channel {
  chat_id: number;
  title: string | null;
  main_invite_link: string | null;
  member_count: number | null;
  member_count_synced_at: string | null;
}

export interface Promoter {
  id: string;
  name: string;
  notes: string | null;
}

export interface TrackingLink {
  id: string;
  chat_id: number;
  promoter_id: string | null;
  invite_link: string;
  label: string | null;
  target_joins: number;
  is_active: boolean;
  created_at: string;
}

export interface TrackingLinkRow extends TrackingLink {
  promoter_name: string | null;
  total_joins: number;
  joins_7d: number;
  net_7d: number;
  premium_pct: number;
  top_language: string | null;
}

export interface ChannelKpis {
  total_member_count_live: number | null;
  total_joins_tracked_all_time: number;
  total_joins_7d: number;
  premium_pct_overall: number;
  top_language: string | null;
  tracking_links_active: number;
  orphan_joins_total: number;
}

// ---------- Channels ----------

export async function listChannels(): Promise<Channel[]> {
  const sb = createAdminClient();
  const { data, error } = await sb
    .from("telegram_channels")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Channel[];
}

export async function getChannel(chatId: number): Promise<Channel | null> {
  const sb = createAdminClient();
  const { data, error } = await sb
    .from("telegram_channels")
    .select("*")
    .eq("chat_id", chatId)
    .maybeSingle();
  if (error) throw error;
  return (data as Channel) ?? null;
}

export async function setChannelMemberCount(
  chatId: number,
  memberCount: number,
): Promise<void> {
  const sb = createAdminClient();
  const { error } = await sb
    .from("telegram_channels")
    .update({
      member_count: memberCount,
      member_count_synced_at: new Date().toISOString(),
    })
    .eq("chat_id", chatId);
  if (error) throw error;
}

// Fetch live member count from Telegram Bot API and cache it.
// Best-effort: returns null on any failure (network, auth, missing token).
export async function refreshLiveMemberCount(
  chatId: number,
): Promise<number | null> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return null;
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${token}/getChatMemberCount?chat_id=${chatId}`,
      { cache: "no-store" },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { ok: boolean; result?: number };
    if (!json.ok || typeof json.result !== "number") return null;
    // best-effort cache update — don't fail render if write fails
    try {
      await setChannelMemberCount(chatId, json.result);
    } catch {
      /* swallow */
    }
    return json.result;
  } catch {
    return null;
  }
}

// ---------- Tracking links ----------

export async function listTrackingLinksForChannel(
  chatId: number,
): Promise<TrackingLinkRow[]> {
  const sb = createAdminClient();
  // Pull tracking links + promoter, then aggregate counters per link
  const { data: links, error: linksErr } = await sb
    .from("telegram_tracking_links")
    .select("*, promoter:telegram_promoters(name)")
    .eq("chat_id", chatId)
    .order("created_at", { ascending: true });
  if (linksErr) throw linksErr;
  if (!links || links.length === 0) return [];

  const linkIds = links.map((l) => l.id as string);
  const sevenDaysAgo = new Date(
    Date.now() - 7 * 24 * 60 * 60 * 1000,
  ).toISOString();

  // Joins per link (all-time + 7d)
  const { data: joinsAll, error: joinsErr } = await sb
    .from("telegram_joins")
    .select("tracking_link_id, ts, raw")
    .in("tracking_link_id", linkIds);
  if (joinsErr) throw joinsErr;

  const totals = new Map<
    string,
    { total: number; last7: number; premium: number; langs: Map<string, number> }
  >();
  for (const id of linkIds) {
    totals.set(id, { total: 0, last7: 0, premium: 0, langs: new Map() });
  }
  for (const j of joinsAll ?? []) {
    const id = j.tracking_link_id as string;
    const bucket = totals.get(id);
    if (!bucket) continue;
    bucket.total += 1;
    if ((j.ts as string) >= sevenDaysAgo) bucket.last7 += 1;
    const user = extractUserFromRaw(j.raw);
    if (user?.is_premium) bucket.premium += 1;
    if (user?.language_code) {
      bucket.langs.set(
        user.language_code,
        (bucket.langs.get(user.language_code) ?? 0) + 1,
      );
    }
  }

  // Leaves per link (last 7d) for net growth
  const leaves7d = new Map<string, number>();
  // We model leaves as inferred from chat_member transitions out — not stored
  // separately yet. For now leaves = 0; net_7d = joins_7d. When we start
  // logging leave events into telegram_joins (or a sibling table), update here.

  return links.map((l) => {
    const bucket = totals.get(l.id as string)!;
    const promoter = (l as unknown as { promoter: { name: string } | null })
      .promoter;
    const topLang =
      [...bucket.langs.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    return {
      id: l.id as string,
      chat_id: l.chat_id as number,
      promoter_id: l.promoter_id as string | null,
      invite_link: l.invite_link as string,
      label: l.label as string | null,
      target_joins: l.target_joins as number,
      is_active: l.is_active as boolean,
      created_at: l.created_at as string,
      promoter_name: promoter?.name ?? null,
      total_joins: bucket.total,
      joins_7d: bucket.last7,
      net_7d: bucket.last7 - (leaves7d.get(l.id as string) ?? 0),
      premium_pct:
        bucket.total > 0 ? (bucket.premium / bucket.total) * 100 : 0,
      top_language: topLang,
    };
  });
}

export async function getTrackingLinkById(
  id: string,
): Promise<(TrackingLink & { promoter_name: string | null }) | null> {
  const sb = createAdminClient();
  const { data, error } = await sb
    .from("telegram_tracking_links")
    .select("*, promoter:telegram_promoters(name)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const promoter = (data as unknown as { promoter: { name: string } | null })
    .promoter;
  return {
    id: data.id as string,
    chat_id: data.chat_id as number,
    promoter_id: data.promoter_id as string | null,
    invite_link: data.invite_link as string,
    label: data.label as string | null,
    target_joins: data.target_joins as number,
    is_active: data.is_active as boolean,
    created_at: data.created_at as string,
    promoter_name: promoter?.name ?? null,
  };
}

export async function setTrackingLinkTarget(
  id: string,
  target: number,
): Promise<void> {
  const sb = createAdminClient();
  const { error } = await sb
    .from("telegram_tracking_links")
    .update({ target_joins: target })
    .eq("id", id);
  if (error) throw error;
}

export async function findTrackingLinkByInvite(
  inviteLink: string,
): Promise<TrackingLink | null> {
  const sb = createAdminClient();
  const { data, error } = await sb
    .from("telegram_tracking_links")
    .select("*")
    .eq("invite_link", inviteLink)
    .maybeSingle();
  if (error) throw error;
  return (data as TrackingLink) ?? null;
}

// ---------- Joins (writes from webhook) ----------

export async function logJoin(args: {
  ts?: string;
  telegram_user_id: number;
  username: string | null;
  first_name: string | null;
  invite_link_used: string | null;
  raw: unknown;
  chat_id: number | null;
  tracking_link_id: string | null;
}): Promise<void> {
  const sb = createAdminClient();
  const { error } = await sb.from("telegram_joins").insert({
    ts: args.ts,
    telegram_user_id: args.telegram_user_id,
    username: args.username,
    first_name: args.first_name,
    invite_link_used: args.invite_link_used,
    raw: args.raw,
    chat_id: args.chat_id,
    tracking_link_id: args.tracking_link_id,
  });
  if (error) throw error;
}

// ---------- Channel-level aggregations ----------

export async function getChannelKpis(chatId: number): Promise<ChannelKpis> {
  const sb = createAdminClient();
  const sevenDaysAgo = new Date(
    Date.now() - 7 * 24 * 60 * 60 * 1000,
  ).toISOString();

  // Pull all joins for this channel (small for now; switch to view when >100k)
  const { data, error } = await sb
    .from("telegram_joins")
    .select("ts, tracking_link_id, raw")
    .eq("chat_id", chatId);
  if (error) throw error;

  let trackedAllTime = 0;
  let trackedLast7 = 0;
  let premium = 0;
  let orphan = 0;
  const langs = new Map<string, number>();

  for (const r of data ?? []) {
    const isTracked = r.tracking_link_id != null;
    if (isTracked) {
      trackedAllTime += 1;
      if ((r.ts as string) >= sevenDaysAgo) trackedLast7 += 1;
    } else {
      orphan += 1;
    }
    const user = extractUserFromRaw(r.raw);
    if (user?.is_premium) premium += 1;
    if (user?.language_code) {
      langs.set(
        user.language_code,
        (langs.get(user.language_code) ?? 0) + 1,
      );
    }
  }
  const total = (data ?? []).length;
  const topLanguage =
    [...langs.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const { count: activeLinks } = await sb
    .from("telegram_tracking_links")
    .select("id", { count: "exact", head: true })
    .eq("chat_id", chatId)
    .eq("is_active", true);

  return {
    total_member_count_live: null, // filled by page using refreshLiveMemberCount
    total_joins_tracked_all_time: trackedAllTime,
    total_joins_7d: trackedLast7,
    premium_pct_overall: total > 0 ? (premium / total) * 100 : 0,
    top_language: topLanguage,
    tracking_links_active: activeLinks ?? 0,
    orphan_joins_total: orphan,
  };
}

// ---------- Tracking-link detail ----------

export interface TrackingLinkDetail {
  link: TrackingLink & { promoter_name: string | null };
  total_joins: number;
  joins_7d: number;
  joins_30d: number;
  premium_count: number;
  premium_pct: number;
  language_breakdown: Array<{ language: string; count: number; pct: number }>;
  recent_joins: Array<{
    ts: string;
    telegram_user_id: number;
    username: string | null;
    first_name: string | null;
    language: string | null;
    is_premium: boolean;
  }>;
  joins_per_day_30d: Array<{ day: string; joins: number }>;
  hourly_heatmap: Array<{ dow: number; hour: number; joins: number }>;
}

export async function getTrackingLinkDetail(
  linkId: string,
): Promise<TrackingLinkDetail | null> {
  const sb = createAdminClient();
  const link = await getTrackingLinkById(linkId);
  if (!link) return null;

  const sevenDaysAgo = new Date(
    Date.now() - 7 * 24 * 60 * 60 * 1000,
  ).toISOString();
  const thirtyDaysAgo = new Date(
    Date.now() - 30 * 24 * 60 * 60 * 1000,
  ).toISOString();

  const { data: joins, error } = await sb
    .from("telegram_joins")
    .select("ts, telegram_user_id, username, first_name, raw")
    .eq("tracking_link_id", linkId)
    .order("ts", { ascending: false });
  if (error) throw error;

  let last7 = 0;
  let last30 = 0;
  let premium = 0;
  const langs = new Map<string, number>();
  const dayCounts = new Map<string, number>();

  for (const j of joins ?? []) {
    if ((j.ts as string) >= sevenDaysAgo) last7 += 1;
    if ((j.ts as string) >= thirtyDaysAgo) {
      last30 += 1;
      const day = (j.ts as string).slice(0, 10);
      dayCounts.set(day, (dayCounts.get(day) ?? 0) + 1);
    }
    const user = extractUserFromRaw(j.raw);
    if (user?.is_premium) premium += 1;
    const lang = user?.language_code ?? "—";
    langs.set(lang, (langs.get(lang) ?? 0) + 1);
  }
  const total = (joins ?? []).length;

  const language_breakdown = [...langs.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([language, count]) => ({
      language,
      count,
      pct: total > 0 ? (count / total) * 100 : 0,
    }));

  const recent_joins = (joins ?? []).slice(0, 15).map((j) => {
    const user = extractUserFromRaw(j.raw);
    return {
      ts: j.ts as string,
      telegram_user_id: j.telegram_user_id as number,
      username: j.username as string | null,
      first_name: j.first_name as string | null,
      language: user?.language_code ?? null,
      is_premium: user?.is_premium ?? false,
    };
  });

  // Fill in 30 days of buckets (zeros where empty)
  const joins_per_day_30d: Array<{ day: string; joins: number }> = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const day = d.toISOString().slice(0, 10);
    joins_per_day_30d.push({ day, joins: dayCounts.get(day) ?? 0 });
  }

  // Hourly heatmap from the view
  const { data: heatmap, error: hmErr } = await sb
    .from("v_telegram_joins_hourly_heatmap")
    .select("dow, hour, joins")
    .eq("tracking_link_id", linkId);
  if (hmErr) throw hmErr;

  return {
    link,
    total_joins: total,
    joins_7d: last7,
    joins_30d: last30,
    premium_count: premium,
    premium_pct: total > 0 ? (premium / total) * 100 : 0,
    language_breakdown,
    recent_joins,
    joins_per_day_30d,
    hourly_heatmap: (heatmap ?? []) as Array<{
      dow: number;
      hour: number;
      joins: number;
    }>,
  };
}

// ---------- helpers ----------

interface TgUserLite {
  id?: number;
  is_premium?: boolean;
  language_code?: string;
  first_name?: string;
  username?: string;
}

function extractUserFromRaw(raw: unknown): TgUserLite | null {
  try {
    const r = raw as {
      chat_member?: { new_chat_member?: { user?: TgUserLite } };
    };
    return r.chat_member?.new_chat_member?.user ?? null;
  } catch {
    return null;
  }
}
