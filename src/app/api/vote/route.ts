import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceSupabase } from "@/lib/supabase/server";
import { serverHashFromHeaders } from "@/lib/server-hash";
import { rateLimit } from "@/lib/rate-limit";
import { voterInfoSchema } from "@/lib/validations";
import { voteErrorMessage } from "@/lib/vote-errors";

const schema = voterInfoSchema.and(
  z.object({
    participant_id: z.string().uuid(),
    fingerprint: z.string().min(1, "Device tidak dikenali"),
    kind: z.enum(["daily5", "fav20"]).default("daily5"),
  })
);

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Data tidak valid" },
      { status: 400 }
    );
  }
  const d = parsed.data;

  // Rate limit per device fingerprint.
  if (!rateLimit(`vote:${d.fingerprint}`, 20, 60_000)) {
    return NextResponse.json(
      { error: "Terlalu banyak percobaan. Coba lagi sebentar." },
      { status: 429 }
    );
  }

  const service = createServiceSupabase();
  const { data, error } = await service.rpc("cast_vote", {
    p_participant_id: d.participant_id,
    p_fingerprint: d.fingerprint,
    p_name: d.name,
    p_phone: d.phone_number,
    p_email: d.email,
    p_status: d.status,
    p_school: d.school || null,
    p_class: d.class || null,
    p_server_hash: serverHashFromHeaders(request.headers),
    // IP soft-limit sementara DINONAKTIFKAN — kirim null agar RPC skip cek IP.
    // Aktifkan lagi: ganti ke ipHashFromRequest(request).
    p_ip_hash: null,
    p_kind: d.kind,
  });

  if (error) {
    const m = error.message;
    const status =
      m.includes("ALREADYVOTED") ||
      m.includes("IPLIMIT") ||
      m.includes("FAV_LIMIT") ||
      m.includes("EVENTCLOSED")
        ? 409
        : 400;
    return NextResponse.json({ error: voteErrorMessage(m) }, { status });
  }

  return NextResponse.json({ ok: true, participant: data });
}
