import { NextRequest, NextResponse } from "next/server";
import { refreshLiveMemberCount } from "@/lib/telegram-queries";

export const runtime = "nodejs";

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ chatId: string }> },
) {
  const { chatId } = await context.params;
  const id = Number(chatId);
  if (!Number.isFinite(id)) {
    return NextResponse.json(
      { error: "chatId must be numeric" },
      { status: 400 },
    );
  }
  const count = await refreshLiveMemberCount(id);
  if (count == null) {
    return NextResponse.json(
      { error: "Telegram API did not return a count" },
      { status: 502 },
    );
  }
  return NextResponse.json({ ok: true, member_count: count });
}
