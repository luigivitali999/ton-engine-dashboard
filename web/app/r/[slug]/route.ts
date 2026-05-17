import { NextRequest, NextResponse } from "next/server";
import { getTelegramConfig, logClick } from "@/lib/telegram-queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;

  let config;
  try {
    config = await getTelegramConfig();
  } catch (e) {
    console.error("[r/slug] config fetch failed:", e);
    return new NextResponse("Configuration error", { status: 500 });
  }

  // Best-effort logging — never block the redirect on DB failure
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    await logClick({
      slug,
      user_agent: request.headers.get("user-agent"),
      ip,
      referer: request.headers.get("referer"),
    });
  } catch (e) {
    console.error("[r/slug] click log failed:", e);
  }

  return NextResponse.redirect(config.tracked_invite_link, 302);
}
