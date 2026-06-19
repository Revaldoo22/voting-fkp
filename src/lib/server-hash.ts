import { createHash } from "crypto";

/**
 * Secondary anti-cheat signal computed server-side from request headers.
 * Combines stable-ish browser headers into a non-reversible hash.
 * Deliberately does NOT include the raw IP address (privacy requirement);
 * only a hashed, salted derivative may be mixed in if desired.
 */
export function serverHashFromHeaders(headers: Headers): string {
  const parts = [
    headers.get("user-agent") ?? "",
    headers.get("accept-language") ?? "",
    headers.get("accept-encoding") ?? "",
    headers.get("sec-ch-ua") ?? "",
    headers.get("sec-ch-ua-platform") ?? "",
  ];
  return createHash("sha256").update(parts.join("|")).digest("hex");
}

/**
 * Non-reversible hash of the client IP (from proxy headers), salted so the
 * raw IP is never stored. Secondary anti-cheat signal only — the account is
 * the primary limiter. Returns null when no IP can be determined.
 */
export function ipHashFromRequest(request: Request): string | null {
  const headers = request.headers;
  const fwd = headers.get("x-forwarded-for");
  const ip =
    (fwd ? fwd.split(",")[0].trim() : "") ||
    headers.get("x-real-ip") ||
    headers.get("cf-connecting-ip") ||
    "";
  if (!ip) return null;
  const salt = process.env.IP_HASH_SALT ?? "fkp-stekom";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}
