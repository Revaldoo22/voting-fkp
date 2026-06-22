// Backup semua file Supabase Storage ke folder lokal.
// Usage: npm run backup:storage
// Output: backups/storage/<bucket>/<path...>
import { readFileSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { dirname } from "node:path";
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

const BUCKETS = ["participant-photos", "quest-proofs"];
const OUT = "backups/storage";

// List semua file (rekursif) dalam bucket.
async function listAll(bucket, prefix = "") {
  const files = [];
  let offset = 0;
  for (;;) {
    const { data, error } = await s.storage
      .from(bucket)
      .list(prefix, { limit: 100, offset, sortBy: { column: "name", order: "asc" } });
    if (error) {
      console.warn(`  list ${bucket}/${prefix}: ${error.message}`);
      break;
    }
    if (!data || data.length === 0) break;
    for (const item of data) {
      const path = prefix ? `${prefix}/${item.name}` : item.name;
      // folder = id null
      if (item.id === null) {
        const sub = await listAll(bucket, path);
        files.push(...sub);
      } else {
        files.push(path);
      }
    }
    if (data.length < 100) break;
    offset += 100;
  }
  return files;
}

const run = async () => {
  let totalFiles = 0;
  let totalBytes = 0;

  for (const bucket of BUCKETS) {
    console.log(`Bucket: ${bucket}`);
    const paths = await listAll(bucket);
    console.log(`  ${paths.length} file ditemukan`);

    let i = 0;
    for (const p of paths) {
      const { data, error } = await s.storage.from(bucket).download(p);
      if (error) {
        console.warn(`  skip ${p}: ${error.message}`);
        continue;
      }
      const buf = Buffer.from(await data.arrayBuffer());
      const dest = `${OUT}/${bucket}/${p}`;
      if (!existsSync(dirname(dest))) mkdirSync(dirname(dest), { recursive: true });
      writeFileSync(dest, buf);
      totalFiles++;
      totalBytes += buf.length;
      i++;
      if (i % 50 === 0) console.log(`  ...${i}/${paths.length}`);
    }
    console.log(`  selesai: ${i} file`);
  }

  console.log(
    `\n✅ Backup storage selesai: ${totalFiles} file, ${(totalBytes / 1024 / 1024).toFixed(1)} MB → ${OUT}/`
  );
};

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
