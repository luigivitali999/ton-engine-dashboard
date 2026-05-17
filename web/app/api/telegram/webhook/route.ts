import { NextRequest, NextResponse } from "next/server";
import {
  getTelegramConfig,
  setChatId,
  logJoin,
} from "@/lib/telegram-queries";

export const runtime = "nodejs";

interface TgUser {
  id: number;
  is_bot?: boolean;
  first_name?: string;
  last_name?: string;
  username?: string;
}

interface ChatMemberUpdate {
  chat: { id: number; title?: string; type: string };
  from?: TgUser;
  date: number;
  old_chat_member: { user: TgUser; status: string };
  new_chat_member: { user: TgUser; status: string };
  invite_link?: { invite_link: string };
}

interface Update {
  update_id: number;
  my_chat_member?: ChatMemberUpdate;
  chat_member?: ChatMemberUpdate;
}

// Telegram status values: creator, administrator, member, restricted, left, kicked.
// A "join" is any transition from an out-of-chat status into an in-chat status.
function isJoinTransition(prev: string, next: string): boolean {
  const wasOut = prev === "left" || prev === "kicked";
  const isIn =
    next === "member" ||
    next === "restricted" ||
    next === "administrator" ||
    next === "creator";
  return wasOut && isIn;
}

export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-telegram-bot-api-secret-token");
  if (!secret || secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  let update: Update;
  try {
    update = await request.json();
  } catch {
    return new NextResponse("Bad JSON", { status: 400 });
  }

  try {
    // Auto-discovery of chat_id: capture it the first time the bot itself is
    // promoted/added to a chat. Stored only if currently NULL in config.
    if (update.my_chat_member) {
      const chatId = update.my_chat_member.chat.id;
      const config = await getTelegramConfig();
      if (config.chat_id === null) {
        await setChatId(chatId);
      }
    }

    // Track joins via chat_member updates (requires allowed_updates on setWebhook).
    if (update.chat_member) {
      const cm = update.chat_member;
      if (
        isJoinTransition(
          cm.old_chat_member.status,
          cm.new_chat_member.status,
        )
      ) {
        const user = cm.new_chat_member.user;
        await logJoin({
          telegram_user_id: user.id,
          username: user.username ?? null,
          first_name: user.first_name ?? null,
          invite_link_used: cm.invite_link?.invite_link ?? null,
          raw: update,
        });
      }
    }
  } catch (e) {
    console.error("[telegram webhook] processing error:", e);
    // Still return 200 so Telegram does not retry-spam on transient DB errors.
  }

  return NextResponse.json({ ok: true });
}
