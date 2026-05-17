import { NextRequest, NextResponse } from "next/server";
import {
  updateTrackingLink,
  deactivateTrackingLink,
  type TrackingLinkPatch,
} from "@/lib/telegram-queries";

export const runtime = "nodejs";

interface PatchBody {
  label?: unknown;
  promoter_id?: unknown;
  target_joins?: unknown;
  is_active?: unknown;
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

  const patch: TrackingLinkPatch = {};

  if (body.label !== undefined) {
    if (body.label !== null && typeof body.label !== "string") {
      return NextResponse.json({ error: "label must be string or null" }, { status: 400 });
    }
    patch.label = (body.label as string | null)?.trim() || null;
  }
  if (body.promoter_id !== undefined) {
    if (body.promoter_id !== null && typeof body.promoter_id !== "string") {
      return NextResponse.json({ error: "promoter_id must be uuid or null" }, { status: 400 });
    }
    patch.promoter_id = body.promoter_id as string | null;
  }
  if (body.target_joins !== undefined) {
    const t = Number(body.target_joins);
    if (!Number.isInteger(t) || t < 1 || t > 10_000_000) {
      return NextResponse.json(
        { error: "target_joins must be 1..10_000_000" },
        { status: 400 },
      );
    }
    patch.target_joins = t;
  }
  if (body.is_active !== undefined) {
    if (typeof body.is_active !== "boolean") {
      return NextResponse.json({ error: "is_active must be boolean" }, { status: 400 });
    }
    patch.is_active = body.is_active;
  }

  try {
    await updateTrackingLink(id, patch);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[api/telegram/tracking-links/:id PATCH]", e);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!id) return NextResponse.json({ error: "id missing" }, { status: 400 });
  try {
    // Soft-delete: deactivate instead of dropping the row, so historical
    // joins remain linked and can still be analyzed.
    await deactivateTrackingLink(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[api/telegram/tracking-links/:id DELETE]", e);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}
