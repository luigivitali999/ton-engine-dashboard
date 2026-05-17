import { NextRequest, NextResponse } from "next/server";
import { setTargetJoins } from "@/lib/telegram-queries";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  let body: { target?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }

  const target = Number(body.target);
  if (!Number.isInteger(target) || target < 1 || target > 10_000_000) {
    return NextResponse.json(
      { error: "Target must be a positive integer up to 10,000,000" },
      { status: 400 },
    );
  }

  try {
    await setTargetJoins(target);
  } catch (e) {
    console.error("[api/telegram/target] update failed:", e);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, target });
}
