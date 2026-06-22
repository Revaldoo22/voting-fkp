import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lockfile project ini = root (cegah Next salah pilih lockfile di home dir).
  outputFileTracingRoot: __dirname,
  images: {
    // Izinkan host Supabase project ini + semua host *.supabase.co
    // (aman saat migrasi: foto dari project lama/baru dua-duanya kebaca).
    remotePatterns: [{ protocol: "https", hostname: "*.supabase.co" }],
  },
};

export default nextConfig;
