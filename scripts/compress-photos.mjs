// Re-compress participant photos already stored in Supabase Storage.
// Usage: npm run compress:photos
// Downloads each photo in the participant-photos bucket, resizes (max 1000px,
// JPEG q80), and re-uploads in place. Updates participants.photo_url if the
// extension changed. Reads env from .env.local.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

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
const BUCKET = "participant-photos";
const MAX = 1000;
const Q = 80;

// Storage path from a public URL.
function pathFromUrl(u) {
  const marker = `/object/public/${BUCKET}/`;
  const i = u.indexOf(marker);
  return i === -1 ? null : decodeURIComponent(u.slice(i + marker.length));
}

const run = async () => {
  const { data: parts, error } = await s
    .from("participants")
    .select("id, name, photo_url")
    .not("photo_url", "is", null);
  if (error) throw error;

  let done = 0,
    skipped = 0,
    saved = 0;

  for (const p of parts) {
    const path = pathFromUrl(p.photo_url);
    if (!path) {
      skipped++;
      continue;
    }
    const { data: blob, error: dErr } = await s.storage.from(BUCKET).download(path);
    if (dErr) {
      console.warn(`  ${p.name}: download gagal (${dErr.message})`);
      skipped++;
      continue;
    }
    const input = Buffer.from(await blob.arrayBuffer());
    const out = await sharp(input)
      .rotate()
      .resize({ width: MAX, height: MAX, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: Q })
      .toBuffer();

    if (out.length >= input.length) {
      skipped++;
      continue; // already small enough
    }

    // Write to a .jpg path (re-encoded as JPEG).
    const newPath = path.replace(/\.[^.]+$/, "") + ".jpg";
    const { error: uErr } = await s.storage
      .from(BUCKET)
      .upload(newPath, out, { contentType: "image/jpeg", upsert: true });
    if (uErr) {
      console.warn(`  ${p.name}: upload gagal (${uErr.message})`);
      skipped++;
      continue;
    }

    const newUrl = s.storage.from(BUCKET).getPublicUrl(newPath).data.publicUrl;
    if (newUrl !== p.photo_url) {
      await s.from("participants").update({ photo_url: newUrl }).eq("id", p.id);
      // remove old file if the path changed
      if (newPath !== path) await s.storage.from(BUCKET).remove([path]);
    }

    saved += input.length - out.length;
    done++;
    console.log(
      `  ${p.name}: ${(input.length / 1024).toFixed(0)}KB -> ${(out.length / 1024).toFixed(0)}KB`
    );
  }

  console.log(
    `\n✅ Selesai. Dikompres: ${done}, dilewati: ${skipped}, hemat ~${(saved / 1024 / 1024).toFixed(2)} MB.`
  );
};

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
