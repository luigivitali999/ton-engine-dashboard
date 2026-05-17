import { createAdminClient } from "@/lib/supabase/admin";

export interface TelegramConfig {
  id: number;
  chat_id: number | null;
  chat_main_link: string | null;
  tracked_invite_link: string;
  target_joins: number;
  updated_at: string;
}

export async function getTelegramConfig(): Promise<TelegramConfig> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("telegram_config")
    .select("*")
    .eq("id", 1)
    .single();
  if (error) throw error;
  return data as TelegramConfig;
}

export async function setTargetJoins(target: number): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("telegram_config")
    .update({ target_joins: target, updated_at: new Date().toISOString() })
    .eq("id", 1);
  if (error) throw error;
}

export async function setChatId(chatId: number): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("telegram_config")
    .update({ chat_id: chatId, updated_at: new Date().toISOString() })
    .eq("id", 1);
  if (error) throw error;
}

export interface ClickStats {
  total: number;
  last_7d: number;
}

export async function getClickStats(): Promise<ClickStats> {
  const supabase = createAdminClient();
  const { count: total, error: e1 } = await supabase
    .from("telegram_clicks")
    .select("id", { count: "exact", head: true });
  if (e1) throw e1;

  const sevenDaysAgo = new Date(
    Date.now() - 7 * 24 * 60 * 60 * 1000,
  ).toISOString();
  const { count: last7, error: e2 } = await supabase
    .from("telegram_clicks")
    .select("id", { count: "exact", head: true })
    .gte("ts", sevenDaysAgo);
  if (e2) throw e2;

  return { total: total ?? 0, last_7d: last7 ?? 0 };
}

export interface JoinStats {
  total_tracked: number;
  last_7d: number;
}

export async function getJoinStats(trackedLink: string): Promise<JoinStats> {
  const supabase = createAdminClient();
  const { count: total, error: e1 } = await supabase
    .from("telegram_joins")
    .select("id", { count: "exact", head: true })
    .eq("invite_link_used", trackedLink);
  if (e1) throw e1;

  const sevenDaysAgo = new Date(
    Date.now() - 7 * 24 * 60 * 60 * 1000,
  ).toISOString();
  const { count: last7, error: e2 } = await supabase
    .from("telegram_joins")
    .select("id", { count: "exact", head: true })
    .eq("invite_link_used", trackedLink)
    .gte("ts", sevenDaysAgo);
  if (e2) throw e2;

  return { total_tracked: total ?? 0, last_7d: last7 ?? 0 };
}

export async function logClick(args: {
  slug: string;
  user_agent?: string | null;
  ip?: string | null;
  referer?: string | null;
}): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("telegram_clicks").insert({
    slug: args.slug,
    user_agent: args.user_agent ?? null,
    ip: args.ip ?? null,
    referer: args.referer ?? null,
  });
  if (error) throw error;
}

export async function logJoin(args: {
  telegram_user_id: number;
  username: string | null;
  first_name: string | null;
  invite_link_used: string | null;
  raw: unknown;
}): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("telegram_joins").insert({
    telegram_user_id: args.telegram_user_id,
    username: args.username,
    first_name: args.first_name,
    invite_link_used: args.invite_link_used,
    raw: args.raw,
  });
  if (error) throw error;
}

export interface RecentJoin {
  ts: string;
  telegram_user_id: number;
  username: string | null;
  first_name: string | null;
}

export async function getRecentJoins(
  limit = 10,
  trackedLink?: string,
): Promise<RecentJoin[]> {
  const supabase = createAdminClient();
  let q = supabase
    .from("telegram_joins")
    .select("ts, telegram_user_id, username, first_name")
    .order("ts", { ascending: false })
    .limit(limit);
  if (trackedLink) q = q.eq("invite_link_used", trackedLink);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as RecentJoin[];
}
