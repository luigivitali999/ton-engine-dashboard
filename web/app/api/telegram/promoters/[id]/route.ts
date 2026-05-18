import { NextRequest, NextResponse } from "next/server";
import { updatePromoter, type PromoterPatch } from "@/lib/telegram-queries";

export const runtime = "nodejs";

interface PatchBody {
  name?: unknown;
  notes?: unknown;
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!id) return NextResponse.json({ error: "id missing" }, { status: 400 });

  let body: PatchBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }

  const patch: PromoterPatch = {};
  if (body.name !== undefined) {
    if (typeof body.name !== "string") {
      return NextResponse.json({ error: "name must be string" }, { status: 400 });
    }
    const trimmed = body.name.trim();
    if (!trimmed) {
      return NextResponse.json({ error: "name cannot be empty" }, { status: 400 });
    }
    if (trimmed.length > 80) {
      return NextResponse.json(
        { error: "name too long (max 80 chars)" },
        { status: 400 },
      );
    }
    patch.name = trimmed;
  }
  if (body.notes !== undefined) {
    if (body.notes !== null && typeof body.notes !== "string") {
      return NextResponse.json({ error: "notes must be string or null" }, { status: 400 });
    }
    patch.notes = body.notes as string | null;
  }

  try {
    await updatePromoter(id, patch);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[api/telegram/promoters/:id PATCH]", e);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}
