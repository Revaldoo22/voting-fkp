import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(n: number | null | undefined): string {
  return new Intl.NumberFormat("id-ID").format(n ?? 0);
}

/** Normalize an Indonesian phone number to a canonical 08xxxx form. */
export function normalizePhone(raw: string): string {
  let p = raw.replace(/[\s\-().]/g, "");
  if (p.startsWith("+62")) p = "0" + p.slice(3);
  else if (p.startsWith("62")) p = "0" + p.slice(2);
  return p;
}
