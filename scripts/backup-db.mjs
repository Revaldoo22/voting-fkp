// Backup semua data Supabase ke file JSON lokal.
// Usage: npm run backup
// Output: backups/backup-<timestamp>.json (berisi semua tabel publik).
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^\s*([\w.]+)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const s = createClient(url, key, { auth: { persistSession: false } });

// Semua tabel data (urut aman untuk restore: parent dulu).
const TABLES = [
  "schools",
  "profiles",
  "participants",
  "participant_contents",
  "quests",
  "submissions",
  "submission_proofs",
  "daily_votes",
  "user_devices",
  "app_settings",
];

const PAGE = 1000; // PostgREST cap; ambil bertahap

async function dumpTable(name) {
  const rows = [];
  let from = 0;
  for (;;) {
    const { data, error } = await s
      .from(name)
      .select("*")
      .range(from, from + PAGE - 1);
    if (error) {
      console.warn(`  ${name}: ${error.message} (skip)`);
      return rows;
    }
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return rows;
}

const run = async () => {
  const dump = { _meta: { source: url, tables: {} }, data: {} };
  for (const t of TABLES) {
    const rows = await dumpTable(t);
    dump.data[t] = rows;
    dump._meta.tables[t] = rows.length;
    console.log(`  ${t}: ${rows.length} baris`);
  }

  mkdirSync("backups", { recursive: true });
  // timestamp dari argumen (Date.now di runtime app aman; pakai ISO lewat arg).
  const stamp = (process.argv[2] || new Date().toISOString())
    .replace(/[:.]/g, "-");
  const file = `backups/backup-${stamp}.json`;
  writeFileSync(file, JSON.stringify(dump, null, 2), "utf8");

  const total = Object.values(dump._meta.tables).reduce((a, b) => a + b, 0);
  console.log(`\n✅ Backup selesai: ${file} (${total} baris total).`);
};

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
