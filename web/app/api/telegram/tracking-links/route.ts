import { NextRequest, NextResponse } from "next/server";
import {
  createTrackingLinkFromUrl,
  createTrackingLinkViaBot,
} from "@/lib/telegram-queries";

export const runtime = "nodejs";

interface CreateBody {
  chat_id?: unknown;
  mode?: unknown;          // "from_url" | "via_bot"
  invite_link?: unknown;   // required if mode === "from_url"
  label?: unknown;
  promoter_id?: unknown;
  target_joins?: unknown;
}

export async function POST(request: NextRequest) {
  let body: CreateBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }

  const chat_id = Number(body.chat_id);
  if (!Number.isFinite(chat_id)) {
    return NextResponse.json(
      { error: "chat_id is required (numeric)" },
      { status: 400 },
    );
  }

  const mode = body.mode === "via_bot" ? "via_bot" : "from_url";
  const label =
    typeof body.label === "string" && body.label.trim()
      ? body.label.trim()
      : null;
  const promoter_id =
    typeof body.promoter_id === "string" && body.promoter_id ? body.promoter_id : null;

  let target_joins = Number(body.target_joins);
  if (!Number.isInteger(target_joins) || target_joins < 1) target_joins = 1000;
  if (target_joins > 10_000_000) {
    return NextResponse.json(
      { error: "target_joins too large" },
      { status: 400 },
    );
  }

  try {
    if (mode === "via_bot") {
      const link = await createTrackingLinkViaBot({
        chat_id,
        label,
        promoter_id,
        target_joins,
      });
      return NextResponse.json({ tracking_link: link }, { status: 201 });
    }

    const invite_link =
      typeof body.invite_link === "string" ? body.invite_link.trim() : "";
    if (!/^https:\/\/t\.me\/\+/.test(invite_link)) {
      return NextResponse.json(
        {
          error:
            "invite_link must be an https://t.me/+... invite URL",
        },
        { status: 400 },
      );
    }
    const link = await createTrackingLinkFromUrl({
      chat_id,
      invite_link,
      label,
      promoter_id,
      target_joins,
    });
    return NextResponse.json({ tracking_link: link }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown error";
    console.error("[api/telegram/tracking-links POST]", msg);
    // Unique-constraint violation on invite_link
    if (msg.includes("duplicate key") || msg.includes("unique")) {
      return NextResponse.json(
        { error: "This invite link is already tracked" },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
