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

/**
 * Find a tracking link by its invite_link, robust to Telegram's truncation.
 *
 * Background: Telegram redacts invite links that the bot itself did NOT create
 * before sending them in chat_member updates. The redacted form keeps the
 * first ~8 chars of the hash and appends literal "..." (e.g.
 * "https://t.me/+cITTYvjl..."). Doing an equality match against the full link
 * stored in our DB therefore always misses, and the join ends up orphaned.
 *
 * Strategy:
 *  - If the incoming link ends with "...", strip them and do a prefix LIKE.
 *  - Otherwise do the exact match (covers bot-created links, which arrive whole).
 *  - When multiple tracking links share a prefix, prefer an active one.
 */
export async function findTrackingLinkByInvite(
  inviteLink: string,
): Promise<TrackingLink | null> {
  const sb = createAdminClient();
  const isTruncated = inviteLink.endsWith("...");
  const stem = isTruncated ? inviteLink.slice(0, -3) : inviteLink;

  const query = sb.from("telegram_tracking_links").select("*");
  const { data, error } = await (isTruncated
    ? query.like("invite_link", `${stem}%`)
    : query.eq("invite_link", stem));
  if (error) throw error;
  const rows = (data ?? []) as TrackingLink[];
  if (rows.length === 0) return null;
  return rows.find((r) => r.is_active) ?? rows[0];
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

// ---------- Promoters CRUD ----------

export async function listPromoters(): Promise<Promoter[]> {
  const sb = createAdminClient();
  const { data, error } = await sb
    .from("telegram_promoters")
    .select("id, name, notes")
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Promoter[];
}

export async function createPromoter(args: {
  name: string;
  notes?: string | null;
}): Promise<Promoter> {
  const sb = createAdminClient();
  const { data, error } = await sb
    .from("telegram_promoters")
    .insert({ name: args.name.trim(), notes: args.notes ?? null })
    .select("id, name, notes")
    .single();
  if (error) throw error;
  return data as Promoter;
}

// ---------- Tracking links CRUD ----------

export async function createTrackingLinkFromUrl(args: {
  chat_id: number;
  invite_link: string;
  label?: string | null;
  promoter_id?: string | null;
  target_joins?: number;
}): Promise<TrackingLink> {
  const sb = createAdminClient();
  const { data, error } = await sb
    .from("telegram_tracking_links")
    .insert({
      chat_id: args.chat_id,
      invite_link: args.invite_link.trim(),
      label: args.label?.trim() || null,
      promoter_id: args.promoter_id ?? null,
      target_joins: args.target_joins ?? 1000,
      is_active: true,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as TrackingLink;
}

/**
 * Ask Telegram to create a brand new invite link on the channel, then persist it.
 * Requires bot to be admin with can_invite_users (default when promoted to admin).
 *
 * The created link is "bot-owned", so future calls to getChatInviteLink work
 * on it — unlike user-created links which return 404.
 */
export async function createTrackingLinkViaBot(args: {
  chat_id: number;
  label?: string | null;
  promoter_id?: string | null;
  target_joins?: number;
}): Promise<TrackingLink> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not configured");

  // Telegram's `name` param shows up in the admin panel of the channel,
  // useful for the channel owner to identify the link in their own client.
  const params = new URLSearchParams({
    chat_id: String(args.chat_id),
    creates_join_request: "false",
  });
  if (args.label) params.set("name", args.label);

  const res = await fetch(
    `https://api.telegram.org/bot${token}/createChatInviteLink?${params.toString()}`,
    { cache: "no-store" },
  );
  if (!res.ok) {
    throw new Error(
      `Telegram createChatInviteLink HTTP ${res.status}: ${await res.text()}`,
    );
  }
  const body = (await res.json()) as {
    ok: boolean;
    description?: string;
    result?: { invite_link: string };
  };
  if (!body.ok || !body.result?.invite_link) {
    throw new Error(
      `Telegram createChatInviteLink failed: ${body.description ?? "unknown"}`,
    );
  }

  return createTrackingLinkFromUrl({
    chat_id: args.chat_id,
    invite_link: body.result.invite_link,
    label: args.label ?? null,
    promoter_id: args.promoter_id ?? null,
    target_joins: args.target_joins,
  });
}

export interface TrackingLinkPatch {
  label?: string | null;
  promoter_id?: string | null;
  target_joins?: number;
  is_active?: boolean;
}

export async function updateTrackingLink(
  id: string,
  patch: TrackingLinkPatch,
): Promise<void> {
  const sb = createAdminClient();
  const update: Record<string, unknown> = {};
  if (patch.label !== undefined) update.label = patch.label;
  if (patch.promoter_id !== undefined) update.promoter_id = patch.promoter_id;
  if (patch.target_joins !== undefined) update.target_joins = patch.target_joins;
  if (patch.is_active !== undefined) update.is_active = patch.is_active;
  if (Object.keys(update).length === 0) return;
  const { error } = await sb
    .from("telegram_tracking_links")
    .update(update)
    .eq("id", id);
  if (error) throw error;
}

export async function deactivateTrackingLink(id: string): Promise<void> {
  await updateTrackingLink(id, { is_active: false });
}

// ---------- Daily breakdown for one tracking link ----------

export interface DailyBreakdownRow {
  day: string;            // YYYY-MM-DD
  joins: number;
  premium: number;
  premium_pct: number;
  top_language: string | null;
}

export async function getDailyBreakdown(
  trackingLinkId: string,
  days = 30,
): Promise<DailyBreakdownRow[]> {
  const sb = createAdminClient();
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await sb
    .from("telegram_joins")
    .select("ts, raw")
    .eq("tracking_link_id", trackingLinkId)
    .gte("ts", since);
  if (error) throw error;

  const byDay = new Map<
    string,
    { joins: number; premium: number; langs: Map<string, number> }
  >();
  for (const j of data ?? []) {
    const day = (j.ts as string).slice(0, 10);
    const bucket =
      byDay.get(day) ?? { joins: 0, premium: 0, langs: new Map() };
    bucket.joins += 1;
    const user = extractUserFromRaw(j.raw);
    if (user?.is_premium) bucket.premium += 1;
    if (user?.language_code) {
      bucket.langs.set(
        user.language_code,
        (bucket.langs.get(user.language_code) ?? 0) + 1,
      );
    }
    byDay.set(day, bucket);
  }

  // Materialize the last N days (with zeros where no data)
  const out: DailyBreakdownRow[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const day = d.toISOString().slice(0, 10);
    const bucket = byDay.get(day);
    if (!bucket) {
      out.push({ day, joins: 0, premium: 0, premium_pct: 0, top_language: null });
      continue;
    }
    const topLang =
      [...bucket.langs.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    out.push({
      day,
      joins: bucket.joins,
      premium: bucket.premium,
      premium_pct: bucket.joins > 0 ? (bucket.premium / bucket.joins) * 100 : 0,
      top_language: topLang,
    });
  }
  return out;
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
