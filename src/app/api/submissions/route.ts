import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceSupabase } from "@/lib/supabase/server";
import { ipHashFromRequest } from "@/lib/server-hash";
import { rateLimit } from "@/lib/rate-limit";
import { voterInfoSchema } from "@/lib/validations";

const schema = voterInfoSchema.and(
  z.object({
    participant_id: z.string().uuid(),
    quest_id: z.string().uuid(),
    proof_url: z.string().url("Bukti tidak valid"),
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

  const ipKey = ipHashFromRequest(request) ?? "noip";
  if (!rateLimit(`submit:${ipKey}`, 30, 60_000)) {
    return NextResponse.json(
      { error: "Terlalu banyak percobaan. Coba lagi sebentar." },
      { status: 429 }
    );
  }

  const service = createServiceSupabase();
  const { error } = await service.rpc("record_submission", {
    p_participant_id: d.participant_id,
    p_quest_id: d.quest_id,
    p_proof_url: d.proof_url,
    p_name: d.name,
    p_phone: d.phone_number,
    p_email: d.email,
    p_status: d.status,
    p_school: d.school || null,
    p_class: d.class || null,
  });

  if (error) {
    const m = error.message;
    if (m.includes("EVENTCLOSED"))
      return NextResponse.json(
        { error: "Event sedang ditutup." },
        { status: 409 }
      );
    if (m.includes("DAILY_DONE"))
      return NextResponse.json(
        { error: "Quest harian ini sudah kamu kerjakan hari ini." },
        { status: 409 }
      );
    if (m.includes("ALREADY_DONE"))
      return NextResponse.json(
        { error: "Kamu sudah mengerjakan quest ini untuk peserta tersebut." },
        { status: 409 }
      );
    if (m.includes("DUPLICATE_LINK"))
      return NextResponse.json(
        {
          error:
            "Link ini sudah pernah dikirim. Setiap link konten hanya bisa dipakai satu kali.",
        },
        { status: 409 }
      );
    if (m.includes("SELFVOTE"))
      return NextResponse.json(
        { error: "Kamu tidak bisa mengerjakan quest untuk dirimu sendiri." },
        { status: 409 }
      );
    if (m.includes("PHONE_NAME"))
      return NextResponse.json(
        {
          error:
            "Nomor WhatsApp ini sudah terdaftar dengan nama lain. Gunakan nama yang sama.",
        },
        { status: 409 }
      );
    if (m.includes("CONTENT_REQUIRED") || m.includes("CONTENT_INVALID"))
      return NextResponse.json(
        { error: "Pilih konten peserta yang valid dulu." },
        { status: 400 }
      );
    return NextResponse.json({ error: m }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
