import { NextRequest, NextResponse } from "next/server";
import {
  findTrackingLinkByInvite,
  logJoin,
} from "@/lib/telegram-queries";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

interface TgUser {
  id: number;
  is_bot?: boolean;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
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
function isJoinTransition(prev: string, next: string): boolean {
  const wasOut = prev === "left" || prev === "kicked";
  const isIn =
    next === "member" ||
    next === "restricted" ||
    next === "administrator" ||
    next === "creator";
  return wasOut && isIn;
}

async function upsertChannelFromUpdate(
  chat: { id: number; title?: string; type: string },
): Promise<void> {
  const sb = createAdminClient();
  await sb
    .from("telegram_channels")
    .upsert(
      { chat_id: chat.id, title: chat.title ?? null },
      { onConflict: "chat_id", ignoreDuplicates: false },
    );
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
    // Auto-register the channel the first time we see it (idempotent upsert).
    if (update.my_chat_member) {
      await upsertChannelFromUpdate(update.my_chat_member.chat);
    }

    if (update.chat_member) {
      const cm = update.chat_member;

      // Make sure the channel row exists before we insert a join referencing it.
      await upsertChannelFromUpdate(cm.chat);

      if (
        isJoinTransition(
          cm.old_chat_member.status,
          cm.new_chat_member.status,
        )
      ) {
        const user = cm.new_chat_member.user;
        const inviteUrl = cm.invite_link?.invite_link ?? null;

        // Resolve tracking_link_id if the invite link is one we track.
        let trackingLinkId: string | null = null;
        if (inviteUrl) {
          const tl = await findTrackingLinkByInvite(inviteUrl);
          trackingLinkId = tl?.id ?? null;
        }

        await logJoin({
          telegram_user_id: user.id,
          username: user.username ?? null,
          first_name: user.first_name ?? null,
          invite_link_used: inviteUrl,
          raw: update,
          chat_id: cm.chat.id,
          tracking_link_id: trackingLinkId,
        });
      }
    }
  } catch (e) {
    console.error("[telegram webhook] processing error:", e);
    // Always return 200 — Telegram retries on non-2xx.
  }

  return NextResponse.json({ ok: true });
}
