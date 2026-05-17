import { NextRequest, NextResponse } from "next/server";
import { listPromoters, createPromoter } from "@/lib/telegram-queries";

export const runtime = "nodejs";

export async function GET() {
  try {
    const promoters = await listPromoters();
    return NextResponse.json({ promoters });
  } catch (e) {
    console.error("[api/telegram/promoters GET]", e);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  let body: { name?: unknown; notes?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  if (name.length > 80) {
    return NextResponse.json(
      { error: "name too long (max 80 chars)" },
      { status: 400 },
    );
  }
  try {
    const promoter = await createPromoter({
      name,
      notes: typeof body.notes === "string" ? body.notes : null,
    });
    return NextResponse.json({ promoter }, { status: 201 });
  } catch (e) {
    console.error("[api/telegram/promoters POST]", e);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}
