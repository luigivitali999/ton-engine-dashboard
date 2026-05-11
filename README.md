# TON-engine-dashboard

Daily snapshot ingestion from Infloww → Supabase + Next.js dashboard.

## Architecture

```
Infloww API ──→ Python ingest (GitHub Actions, daily)
                    │
                    ▼
              Supabase Postgres (eu-central-1)
                    │
                    ▼
              Next.js web app (Vercel)
```

- **Daily snapshot** of `/v1/links` (TRIAL, TRACKING, CAMPAIGN) per creator
- **Keyword filter on ingest:** only links whose name contains `network`, `manu`, `tg`, `ig`, `telegram` (case-insensitive) are stored. The count of skipped links per run is recorded in `ingest_runs.links_skipped_count`.
- **Delta + weekly OHLC candles** are computed via SQL views, not stored

## Supabase project

- Project ref: `gwgcwdcnnrrjygbkcnwt`
- URL: `https://gwgcwdcnnrrjygbkcnwt.supabase.co`
- Region: `eu-central-1` (Frankfurt — minima latenza dall'Italia)
- Organization: Prime Pro Management's Org

## Ingest script

### Local run

```bash
cd ingest
cp .env.example .env
# fill in INFLOWW_API_KEY, INFLOWW_OID, SUPABASE_SERVICE_ROLE_KEY

pip install -r requirements.txt
set -a && source .env && set +a   # load .env into the shell
python ingest_infloww.py
```

Re-running on the same day is idempotent — the `(snapshot_date, link_id)` unique constraint upserts.

### GitHub Actions

Workflow at `.github/workflows/daily-ingest.yml` runs at **03:00 UTC** daily.

Required repository secrets (Settings → Secrets and variables → Actions):

| Secret                       | Source                                                     |
|------------------------------|------------------------------------------------------------|
| `INFLOWW_API_KEY`            | Infloww → API key management page                          |
| `INFLOWW_OID`                | Infloww → API key management page ("Agency OID")           |
| `SUPABASE_URL`               | `https://gwgcwdcnnrrjygbkcnwt.supabase.co`                 |
| `SUPABASE_SERVICE_ROLE_KEY`  | Supabase dashboard → Project Settings → API → service_role |

⚠️ The service_role key bypasses RLS. Never expose it client-side.

## Database

Tables and views:

- `creators` — connected creators
- `links` — master record per link (only those passing the keyword filter)
- `links_daily` — 1 row per (link, day). Cumulative metrics from Infloww.
- `linkfans` — drill-down per single link (phase 2)
- `ingest_runs` — log of each ingest run
- `v_links_daily_delta` — adds `subs_today`, `earnings_*_today`, `clicks_today` via LAG window
- `v_links_weekly_candles` — weekly OHLC over daily deltas (subs, revenue net, revenue gross)
- `v_creator_daily_aggregate` — aggregated metrics per creator per day

## API delay notes

Infloww has a sync delay on OnlyFans data:

- `/v1/transactions` — up to 1h
- `/v1/links` — up to 2h
- `/v1/linkfans` — up to 4h

The 03:00 UTC cron is past all delays for a snapshot of "yesterday in UTC terms".
