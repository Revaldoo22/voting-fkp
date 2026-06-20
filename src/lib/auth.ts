import { normalizePhone } from "@/lib/utils";
import type { Role } from "@/types/database";

/**
 * Admin & participant accounts are real Supabase auth users keyed by a
 * synthetic email derived from their phone number. This keeps password
 * handling inside Supabase Auth (no custom hashing) while letting users
 * "log in with WhatsApp number + password".
 */
export function phoneToEmail(phone: string): string {
  return `${normalizePhone(phone)}@stekom.local`;
}

/** Default landing route per role. */
export function roleHome(role: Role): string {
  switch (role) {
    case "admin":
      return "/admin";
    case "participant":
      return "/participant/dashboard";
    default:
      return "/";
  }
}

/** Generate a human-friendly password for a new participant account. */
export function generatePassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  const bytes = new Uint8Array(8);
  // crypto is available in the Edge/Node runtimes used by route handlers.
  (globalThis.crypto ?? require("crypto").webcrypto).getRandomValues(bytes);
  for (const b of bytes) out += chars[b % chars.length];
  return `STK-${out.slice(0, 4)}-${out.slice(4)}`;
}
