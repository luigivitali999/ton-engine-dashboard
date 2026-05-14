import { createClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client using the service-role key.
 *
 * - Bypasses Row Level Security (because we use RLS to lock down direct DB access
 *   from the browser, and route ALL reads/writes through the Next.js backend).
 * - Never bundle this into a client component — the service key must not leak.
 *
 * The caller is responsible for any authorization checks (e.g. password cookie).
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!serviceKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is missing. Set it in .env.local locally and in Vercel env vars in production.",
    );
  }
  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
