import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lockfile project ini = root (cegah Next salah pilih lockfile di home dir).
  outputFileTracingRoot: __dirname,
  images: {
    // Izinkan host Supabase project ini + semua host *.supabase.co
    // (aman saat migrasi: foto dari project lama/baru dua-duanya kebaca).
    remotePatterns: [{ protocol: "https", hostname: "*.supabase.co" }],
    // Matikan Vercel Image Optimization: kuota free habis (402 Payment
    // Required -> gambar blank). Supabase sudah jadi CDN + foto sudah
    // dikompres, jadi optimizer mubazir. Serve gambar langsung.
    unoptimized: true,
  },
};

export default nextConfig;
