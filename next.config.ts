import type { NextConfig } from "next";

const supabaseHost = (() => {
  try {
    return process.env.NEXT_PUBLIC_SUPABASE_URL
      ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
      : undefined;
  } catch {
    return undefined;
  }
})();

const nextConfig: NextConfig = {
  // Lockfile project ini = root (cegah Next salah pilih lockfile di home dir).
  outputFileTracingRoot: __dirname,
  images: {
    remotePatterns: supabaseHost
      ? [{ protocol: "https", hostname: supabaseHost }]
      : [{ protocol: "https", hostname: "*.supabase.co" }],
  },
};

export default nextConfig;
