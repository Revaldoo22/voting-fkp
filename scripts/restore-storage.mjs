// Upload ulang semua file dari backups/storage/ ke Supabase Storage.
// Usage: npm run restore:storage
// Set .env.local ke project BARU dulu (URL + service role baru).
// Bucket dibuat otomatis jika belum ada (public).
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { createClient as makeClient } from "@supabase/supabase-js";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^\s*([\w.]+)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error("Missing env"); process.exit(1); }
const s = makeClient(url, key, { auth: { persistSession: false } });

const ROOT = "backups/storage";
const BUCKETS = ["participant-photos", "quest-proofs"];

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

const contentType = (f) => {
  const e = f.toLowerCase().split(".").pop();
  return e === "png" ? "image/png"
    : e === "webp" ? "image/webp"
    : e === "gif" ? "image/gif"
    : e === "mp4" ? "video/mp4"
    : "image/jpeg";
};

const run = async () => {
  for (const bucket of BUCKETS) {
    await s.storage.createBucket(bucket, { public: true }).catch(() => {});
    const base = join(ROOT, bucket);
    let files = [];
    try { files = walk(base); } catch { console.log(`  ${bucket}: folder tidak ada, skip`); continue; }
    let ok = 0;
    for (const abs of files) {
      const path = relative(base, abs).split("\\").join("/");
      const buf = readFileSync(abs);
      const { error } = await s.storage
        .from(bucket)
        .upload(path, buf, { contentType: contentType(abs), upsert: true });
      if (error) console.warn(`  skip ${path}: ${error.message}`);
      else ok++;
      if (ok % 100 === 0) console.log(`  ${bucket}: ${ok}/${files.length}`);
    }
    console.log(`  ${bucket}: ${ok}/${files.length} terupload`);
  }
  console.log("\n✅ Restore storage selesai.");
};
run().catch((e) => { console.error(e); process.exit(1); });
