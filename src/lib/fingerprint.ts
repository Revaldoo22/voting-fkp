"use client";

import FingerprintJS from "@fingerprintjs/fingerprintjs";

let cached: Promise<string> | null = null;

/** Returns a stable visitor identifier for this device/browser. */
export function getFingerprint(): Promise<string> {
  if (cached) return cached;
  cached = (async () => {
    const fp = await FingerprintJS.load();
    const result = await fp.get();
    return result.visitorId;
  })();
  return cached;
}
