import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/session";

export async function POST(request: NextRequest) {
  const res = NextResponse.redirect(new URL("/unlock", request.url), {
    status: 303,
  });
  res.cookies.delete(SESSION_COOKIE_NAME);
  return res;
}
