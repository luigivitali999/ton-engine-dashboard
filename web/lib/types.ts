/**
 * Types reflecting the public schema of the TON-engine Supabase project.
 * Hand-maintained — kept narrow to the rows the dashboard actually reads.
 */

export type LinkType = "TRIAL" | "TRACKING";

export interface Creator {
  id: string;
  user_name: string | null;
  nick_name: string | null;
  name: string | null;
  tag_name: string | null;
  active: boolean;
}

export interface LinkMaster {
  id: string;
  creator_id: string;
  link_type: LinkType;
  name: string | null;
  source: string | null;
  excluded: boolean;
  excluded_at: string | null;
  excluded_reason: string | null;
}

/** v_links_daily_delta — one row per (link, day) with computed deltas. */
export interface LinkDailyDelta {
  snapshot_date: string;
  link_id: string;
  creator_id: string;
  link_type: LinkType;

  // cumulative ("lifetime") values
  sub_count: number;
  paying_fans_count: number;
  earnings_gross: string; // numeric → string from Supabase
  earnings_net: string;
  click_count: number | null;
  subscription_cvr: string | null;
  spending_cvr: string | null;
  epc_gross: string | null;
  epc_net: string | null;
  aeps_gross: string | null;
  aeps_net: string | null;
  spend_claim: string | null;
  currency: string;

  // delta ("today")
  subs_today: number;
  paying_fans_today: number;
  earnings_gross_today: string;
  earnings_net_today: string;
  clicks_today: number | null;
  prev_snapshot_date: string | null;
}

/** Time range presets the UI exposes. */
export type TimeRange = "today" | "7d" | "30d" | "all";

/** Aggregated metric the UI computes per (creator, period). */
export interface CreatorAggregate {
  creator_id: string;
  creator_name: string;
  link_count: number;
  subs: number;
  paying_fans: number;
  earnings_gross: number;
  earnings_net: number;
  clicks: number;
  avg_cvr: number | null;
}

/** Per-link computed metrics over a period (sum of deltas). */
export interface LinkAggregate {
  link_id: string;
  link_name: string;
  link_type: LinkType;
  creator_id: string;
  creator_name: string;
  subs: number;
  paying_fans: number;
  earnings_gross: number;
  earnings_net: number;
  clicks: number | null;
  cvr: number | null;
  arpu: number | null;
  excluded: boolean;
}
