"""
ingest_infloww.py — Daily snapshot ingestion for TON-engine-dashboard.

Pulls /v1/creators and /v1/links (TRIAL, TRACKING, CAMPAIGN) from Infloww
and writes daily snapshots to Supabase.

Only links whose name (case-insensitive) contains one of:
    network · manu · tg · ig · telegram
are stored. Skipped links are logged in `links_skipped` for visibility.

Designed to run as a daily cron at 03:00 UTC, after Infloww's 2h sync delay
on /v1/links. Idempotent: re-running on the same day will UPSERT the snapshot.

Environment variables required:
    INFLOWW_API_KEY              raw API key (no "Bearer" prefix)
    INFLOWW_OID                  agency OID
    SUPABASE_URL                 https://<project-ref>.supabase.co
    SUPABASE_SERVICE_ROLE_KEY    service_role key (server-side only)
"""

from __future__ import annotations

import json
import logging
import os
import re
import sys
import time
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone
from typing import Any, Iterator

import requests
from supabase import Client, create_client


# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

INFLOWW_BASE_URL = "https://openapi.infloww.com"

LINK_NAME_KEYWORDS: tuple[str, ...] = ("network", "manu", "tg", "ig", "telegram")
LINK_TYPES: tuple[str, ...] = ("TRIAL", "TRACKING")
PAGE_LIMIT = 100  # API maximum

# Infloww /v1/links defaults startTime to "3 days before endTime", which silently
# hides links created more than 3 days ago. We pass an explicit 365d lookback
# (the API's hard cap) to retrieve the full active inventory.
INGEST_LOOKBACK_DAYS = 365

# Word-boundary keyword matching: keyword must NOT be flanked by ASCII letters.
# Prevents false positives like "ig" inside "significa", "GRATIS", etc.
KEYWORD_PATTERN = re.compile(
    r"(?<![a-zA-Z])(" + "|".join(LINK_NAME_KEYWORDS) + r")(?![a-zA-Z])",
    re.IGNORECASE,
)

# Sleep between paginated calls (gentle rate-limit hygiene)
PAGINATION_DELAY_S = 0.2


# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-7s  %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S%z",
)
log = logging.getLogger("ingest")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def require_env(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        log.error("Missing required env var: %s", name)
        sys.exit(2)
    return value


def cents_to_dollars(value: Any) -> float:
    """Infloww returns monetary amounts in the smallest currency unit (cents)."""
    if value is None or value == "":
        return 0.0
    try:
        return float(value) / 100.0
    except (ValueError, TypeError):
        return 0.0


def parse_percent(value: Any) -> float | None:
    """Infloww returns CVR/spendClaim as a string like '0' or '24.8'."""
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (ValueError, TypeError):
        return None


def ms_to_iso(value: Any) -> str | None:
    """Convert Infloww unix-ms timestamp (string or int) to ISO 8601 UTC."""
    if value is None or value == "":
        return None
    try:
        ms = int(value)
        return datetime.fromtimestamp(ms / 1000, tz=timezone.utc).isoformat()
    except (ValueError, TypeError):
        return None


def link_passes_keyword_filter(name: str | None) -> bool:
    """True if the link name contains any keyword as a word (not as substring inside another word)."""
    if not name:
        return False
    return bool(KEYWORD_PATTERN.search(name))


def link_display_name(link: dict) -> str | None:
    """TRIAL/TRACKING use `name`; CAMPAIGN uses `message` as its description."""
    return link.get("name") or link.get("message")


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------------------------------------------------------------------------
# Infloww API client
# ---------------------------------------------------------------------------

class InflowwClient:
    """Minimal client for the read-only Infloww REST API."""

    def __init__(self, api_key: str, oid: str) -> None:
        self.session = requests.Session()
        self.session.headers.update({
            "Authorization": api_key,    # raw key, no "Bearer "
            "x-oid": oid,
        })

    def _get(self, path: str, params: dict[str, Any] | None = None) -> dict:
        url = f"{INFLOWW_BASE_URL}{path}"
        resp = self.session.get(url, params=params or {}, timeout=30)
        resp.raise_for_status()
        return resp.json()

    def paginate(self, path: str, params: dict[str, Any] | None = None) -> Iterator[dict]:
        """Yield items across all pages, following the cursor."""
        params = dict(params or {})
        params.setdefault("limit", PAGE_LIMIT)
        cursor: Any = None
        while True:
            if cursor is not None:
                params["cursor"] = cursor
            payload = self._get(path, params)
            data = payload.get("data") or {}
            items = data.get("list") or []
            for item in items:
                yield item
            if not payload.get("hasMore"):
                return
            cursor = payload.get("cursor")
            if not cursor:
                return
            time.sleep(PAGINATION_DELAY_S)

    def list_creators(self) -> list[dict]:
        return list(self.paginate("/v1/creators"))

    def list_links(self, creator_id: str, link_type: str, start_time: str | None = None) -> list[dict]:
        params: dict[str, Any] = {
            "creatorId": creator_id,
            "linkType": link_type,
        }
        if start_time:
            params["startTime"] = start_time
        return list(self.paginate("/v1/links", params))


# ---------------------------------------------------------------------------
# Supabase upserts
# ---------------------------------------------------------------------------

def upsert_creator(sb: Client, creator: dict) -> str:
    row = {
        "id": str(creator.get("id")),
        "name": creator.get("name"),
        "nick_name": creator.get("nickName"),
        "user_name": creator.get("userName"),
        "tag_name": creator.get("tagName"),
        "infloww_created_time": ms_to_iso(creator.get("createdTime")),
        "last_seen": now_iso(),
        "active": True,
    }
    sb.table("creators").upsert(row, on_conflict="id").execute()
    return row["id"]


def upsert_link_master(sb: Client, link: dict, creator_id: str, link_type: str) -> None:
    row = {
        "id": str(link.get("id")),
        "creator_id": creator_id,
        "link_type": link_type,
        "name": link_display_name(link),
        "code": link.get("code"),
        "source": link.get("source"),
        "sub_duration": link.get("subDuration"),
        "sub_limit": link.get("subLimit"),
        "discount": link.get("discount"),
        "campaign_type": link.get("type") if link_type == "CAMPAIGN" else None,
        "infloww_created_time": ms_to_iso(link.get("createdTime")),
        "expired_time": ms_to_iso(link.get("expiredTime")),
        "finished": bool(link.get("finishedFlag", False)),
        "last_seen": now_iso(),
        "active": True,
    }
    sb.table("links").upsert(row, on_conflict="id").execute()


def upsert_link_daily(
    sb: Client,
    link: dict,
    creator_id: str,
    link_type: str,
    snapshot_date: date,
) -> None:
    row = {
        "snapshot_date": snapshot_date.isoformat(),
        "link_id": str(link.get("id")),
        "creator_id": creator_id,
        "link_type": link_type,
        # common metrics
        "sub_count": int(link.get("subCount") or 0),
        "paying_fans_count": int(link.get("payingFansCount") or 0),
        "earnings_gross": cents_to_dollars(link.get("earningsGross")),
        "earnings_net": cents_to_dollars(link.get("earningsNet")),
        "currency": link.get("currency") or "USD",
        # TRACKING-only
        "click_count": link.get("clickCount"),
        "subscription_cvr": parse_percent(link.get("subscriptionCVR")),
        "spending_cvr": parse_percent(link.get("spendingCVR")),
        "epc_gross": cents_to_dollars(link["epcGross"]) if link.get("epcGross") is not None else None,
        "epc_net": cents_to_dollars(link["epcNet"]) if link.get("epcNet") is not None else None,
        # TRACKING + TRIAL
        "aeps_gross": cents_to_dollars(link["aepsGross"]) if link.get("aepsGross") is not None else None,
        "aeps_net": cents_to_dollars(link["aepsNet"]) if link.get("aepsNet") is not None else None,
        # TRIAL-only
        "spend_claim": parse_percent(link.get("spendClaim")),
    }
    sb.table("links_daily").upsert(row, on_conflict="snapshot_date,link_id").execute()


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

@dataclass
class RunStats:
    creators_count: int = 0
    links_count: int = 0
    skipped_count: int = 0
    errors: list[dict] = field(default_factory=list)


def run_ingest() -> int:
    infloww_api_key = require_env("INFLOWW_API_KEY")
    infloww_oid = require_env("INFLOWW_OID")
    supabase_url = require_env("SUPABASE_URL")
    supabase_service_role_key = require_env("SUPABASE_SERVICE_ROLE_KEY")

    sb: Client = create_client(supabase_url, supabase_service_role_key)
    infloww = InflowwClient(infloww_api_key, infloww_oid)

    snapshot_date = datetime.now(timezone.utc).date()
    lookback_start = (datetime.now(timezone.utc) - timedelta(days=INGEST_LOOKBACK_DAYS)).isoformat()
    log.info("Starting ingest for snapshot_date=%s (lookback from %s)", snapshot_date.isoformat(), lookback_start)

    # Open a run record
    run_record = sb.table("ingest_runs").insert({
        "snapshot_date": snapshot_date.isoformat(),
        "status": "running",
    }).execute()
    run_id = run_record.data[0]["id"]
    stats = RunStats()
    skipped_diagnostic: list[dict] = []  # one-off: record skipped link names for filter tuning

    try:
        log.info("Pulling /v1/creators ...")
        creators = infloww.list_creators()
        stats.creators_count = len(creators)
        log.info("  → %d creators", stats.creators_count)

        for creator in creators:
            creator_id = upsert_creator(sb, creator)
            creator_name = creator.get("userName") or creator.get("name") or "n/a"
            log.info("· creator %s (%s)", creator_id, creator_name)

            for link_type in LINK_TYPES:
                try:
                    links = infloww.list_links(creator_id, link_type, start_time=lookback_start)
                except requests.HTTPError as exc:
                    msg = f"{link_type} for creator {creator_id}: {exc}"
                    log.warning("  ! %s", msg)
                    stats.errors.append({"creator_id": creator_id, "link_type": link_type, "error": str(exc)})
                    continue

                kept_here = 0
                skipped_here = 0
                for link in links:
                    name = link_display_name(link)
                    if link_passes_keyword_filter(name):
                        upsert_link_master(sb, link, creator_id, link_type)
                        upsert_link_daily(sb, link, creator_id, link_type, snapshot_date)
                        kept_here += 1
                    else:
                        skipped_diagnostic.append({
                            "creator": creator_name,
                            "type": link_type,
                            "name": name or "(no name)",
                        })
                        skipped_here += 1

                stats.links_count += kept_here
                stats.skipped_count += skipped_here
                log.info("  %-9s · kept %d · skipped %d", link_type, kept_here, skipped_here)

        log.info(
            "Done. creators=%d  links=%d  skipped=%d  errors=%d",
            stats.creators_count, stats.links_count, stats.skipped_count, len(stats.errors),
        )

        sb.table("ingest_runs").update({
            "ended_at": now_iso(),
            "status": "completed",
            "creators_count": stats.creators_count,
            "links_count": stats.links_count,
            "links_skipped_count": stats.skipped_count,
            "errors": stats.errors or None,
            "notes": json.dumps({"skipped_links": skipped_diagnostic[:500]}) if skipped_diagnostic else None,
        }).eq("id", run_id).execute()
        return 0

    except Exception as exc:
        log.exception("Ingest failed")
        stats.errors.append({"fatal": str(exc)})
        sb.table("ingest_runs").update({
            "ended_at": now_iso(),
            "status": "failed",
            "creators_count": stats.creators_count,
            "links_count": stats.links_count,
            "links_skipped_count": stats.skipped_count,
            "errors": stats.errors,
        }).eq("id", run_id).execute()
        return 1


if __name__ == "__main__":
    sys.exit(run_ingest())
