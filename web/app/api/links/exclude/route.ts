import { createAdminClient } from "@/lib/supabase/admin";
import { isSessionValid } from "@/lib/session";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Toggle a link's excluded flag.
 *
 * Auth: the password-gate cookie must be valid. (RLS is on, the publishable key
 * doesn't have UPDATE permission — only the service-role client does, and that's
 * only available server-side, so this route is the single gate to mutations.)
 */
export async function POST(request: NextRequest) {
  // Password-gate check
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("ton_session")?.value;
  if (!isSessionValid(sessionCookie)) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (
    !body ||
    typeof body.linkId !== "string" ||
    typeof body.excluded !== "boolean"
  ) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const { linkId, excluded } = body;
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("links")
    .update({
      excluded,
      excluded_at: excluded ? new Date().toISOString() : null,
      excluded_reason: excluded ? "excluded manually" : null,
    })
    .eq("id", linkId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
