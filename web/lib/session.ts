import { createHmac, timingSafeEqual } from "crypto";

const COOKIE_NAME = "ton_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

/**
 * Build a session token tied to the password + secret.
 *
 * Format: base64url(payload).base64url(hmac)
 * where payload = "v1.<expires_at_unix>"
 */
export function signSession(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is missing");
  const expires = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const payload = `v1.${expires}`;
  const sig = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${Buffer.from(payload).toString("base64url")}.${sig}`;
}

/**
 * Validate a session cookie value. Returns true iff the HMAC matches and
 * the expiration timestamp is in the future.
 */
export function isSessionValid(value: string | undefined): boolean {
  if (!value) return false;
  const secret = process.env.SESSION_SECRET;
  if (!secret) return false;

  const parts = value.split(".");
  if (parts.length !== 2) return false;
  const [payloadB64, sigB64] = parts;
  let payload: string;
  try {
    payload = Buffer.from(payloadB64, "base64url").toString("utf-8");
  } catch {
    return false;
  }
  const expectedSig = createHmac("sha256", secret)
    .update(payload)
    .digest("base64url");

  // Constant-time compare
  const sigBuf = Buffer.from(sigB64);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length) return false;
  if (!timingSafeEqual(sigBuf, expBuf)) return false;

  const [version, expiresStr] = payload.split(".");
  if (version !== "v1") return false;
  const expires = parseInt(expiresStr, 10);
  if (!Number.isFinite(expires)) return false;
  return Math.floor(Date.now() / 1000) < expires;
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;
export const SESSION_TTL = SESSION_TTL_SECONDS;
