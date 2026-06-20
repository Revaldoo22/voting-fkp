// Seed dummy schools, participants (with Unsplash photos) and voters.
// Usage: npm run seed:dummy
// Reads NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from .env.local.
//
// Voters are anonymous (no accounts). We insert daily_votes rows directly with
// voter_phone/name/etc. so the Top Voter & Supporter leaderboards populate.
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
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

// Unsplash portrait photos (stable IDs).
const PHOTOS = [
  "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=600&h=600&fit=crop",
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=600&h=600&fit=crop",
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=600&h=600&fit=crop",
  "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=600&h=600&fit=crop",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&h=600&fit=crop",
  "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=600&h=600&fit=crop",
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&h=600&fit=crop",
  "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=600&h=600&fit=crop",
];

const SCHOOLS = [
  "SMA Negeri 1 Semarang",
  "SMK Negeri 7 Semarang",
  "SMA Kesatrian 1 Semarang",
  "SMK Telkom Semarang",
];

const PARTICIPANTS = [
  ["Budi Santoso", 0, "Aktif di OSIS, hobi public speaking."],
  ["Siti Nurhaliza", 0, "Juara olimpiade matematika tingkat kota."],
  ["Ahmad Fauzi", 1, "Ketua ekskul robotik."],
  ["Dewi Lestari", 1, "Penulis cerpen, aktif di mading sekolah."],
  ["Rizky Pratama", 2, "Atlet basket, kapten tim sekolah."],
  ["Nadia Putri", 2, "Relawan lingkungan & daur ulang."],
  ["Fajar Hidayat", 3, "Programmer muda, juara lomba coding."],
  ["Maya Sari", 3, "Penari tradisional, duta budaya sekolah."],
];

const VOTERS = [
  ["Andi Wijaya", "081234500001"],
  ["Rina Melati", "081234500002"],
  ["Toni Kurniawan", "081234500003"],
  ["Lia Anggraini", "081234500004"],
  ["Bayu Saputra", "081234500005"],
  ["Dina Oktaviani", "081234500006"],
];

const STATUSES = ["teman_sekolah", "guru", "keluarga", "teman_luar"];

const pick = (arr, i) => arr[i % arr.length];

// Download an Unsplash photo and upload it to the participant-photos bucket,
// returning the public Storage URL (so we don't hotlink Unsplash).
async function uploadPhoto(srcUrl, idx) {
  const res = await fetch(srcUrl);
  if (!res.ok) throw new Error(`fetch foto gagal (${res.status})`);
  const buf = Buffer.from(await res.arrayBuffer());
  const path = `dummy/peserta-${idx + 1}-${Date.now()}.jpg`;
  const { error } = await s.storage
    .from("participant-photos")
    .upload(path, buf, { contentType: "image/jpeg", upsert: true });
  if (error) throw new Error("upload gagal: " + error.message);
  return s.storage.from("participant-photos").getPublicUrl(path).data.publicUrl;
}

const run = async () => {
  // 1) Schools
  const schoolIds = {};
  for (const name of SCHOOLS) {
    const { data: existing } = await s
      .from("schools")
      .select("id")
      .ilike("name", name)
      .maybeSingle();
    if (existing) {
      schoolIds[name] = existing.id;
    } else {
      const { data, error } = await s
        .from("schools")
        .insert({ name })
        .select("id")
        .single();
      if (error) throw error;
      schoolIds[name] = data.id;
    }
  }
  console.log(`Schools ready: ${SCHOOLS.length}`);

  // 2) Participants (managed entities, no login needed for dummy)
  const participantIds = [];
  for (let i = 0; i < PARTICIPANTS.length; i++) {
    const [name, schoolIdx, desc] = PARTICIPANTS[i];
    const school_id = schoolIds[SCHOOLS[schoolIdx]];
    let photo_url = null;
    try {
      photo_url = await uploadPhoto(PHOTOS[i % PHOTOS.length], i);
      process.stdout.write(`  foto ${i + 1}/${PARTICIPANTS.length} ✓\n`);
    } catch (e) {
      console.warn(`  foto ${i + 1} gagal: ${e.message} (lanjut tanpa foto)`);
    }
    const { data, error } = await s
      .from("participants")
      .insert({
        name,
        school_id,
        description: desc,
        photo_url,
        status: "active",
        total_points: 0,
      })
      .select("id")
      .single();
    if (error) throw error;
    participantIds.push(data.id);
  }
  console.log(`Participants ready: ${participantIds.length}`);

  // 3) Dummy votes — spread voters across participants so leaderboards fill.
  //    Each vote = +5 points. Insert directly (bypass per-day constraints by
  //    using distinct vote_date per (participant, voter)).
  let voteCount = 0;
  const today = new Date();
  for (let vi = 0; vi < VOTERS.length; vi++) {
    const [vname, vphone] = VOTERS[vi];
    const email = `voter${vi + 1}@dummy.local`;
    // Each voter supports a few participants.
    const targets = participantIds.filter((_, pi) => (pi + vi) % 2 === 0);
    for (let t = 0; t < targets.length; t++) {
      const pid = targets[t];
      // distinct day offset to satisfy (participant, phone, vote_date) unique
      const d = new Date(today);
      d.setDate(d.getDate() - t);
      const voteDate = d.toISOString().slice(0, 10);
      const { error } = await s.from("daily_votes").insert({
        participant_id: pid,
        device_fingerprint: `dummy-${randomUUID()}`,
        voter_name: vname,
        voter_phone: vphone,
        voter_email: email,
        voter_status: pick(STATUSES, vi),
        voter_school: vi % 2 === 0 ? pick(SCHOOLS, vi) : null,
        voter_class: vi % 2 === 0 ? pick(["10", "11", "12", "alumni"], vi) : null,
        vote_date: voteDate,
      });
      if (error) {
        console.warn("vote skip:", error.message);
        continue;
      }
      // bump participant points
      const { data: cur } = await s
        .from("participants")
        .select("total_points")
        .eq("id", pid)
        .single();
      await s
        .from("participants")
        .update({ total_points: (cur?.total_points ?? 0) + 5 })
        .eq("id", pid);
      voteCount++;
    }
  }
  console.log(`Dummy votes inserted: ${voteCount}`);
  console.log("✅ Seed dummy selesai. Buka halaman utama & /top-voter.");
};

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
