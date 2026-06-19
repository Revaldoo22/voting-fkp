import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";

const schema = z.object({
  quest_id: z.string().uuid(),
  participant_id: z.string().uuid(),
  proof_url: z.string().url(),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
  }

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sesi tidak valid." }, { status: 401 });
  }

  // RLS guarantees status='pending' & user_id = auth.uid().
  const { error } = await supabase.from("submissions").insert({
    user_id: user.id,
    quest_id: parsed.data.quest_id,
    participant_id: parsed.data.participant_id,
    proof_url: parsed.data.proof_url,
    status: "pending",
  });

  if (error) {
    if (error.message.includes("DAILY_DONE")) {
      return NextResponse.json(
        { error: "Quest harian ini sudah kamu kerjakan hari ini. Coba lagi besok." },
        { status: 409 }
      );
    }
    if (error.message.includes("ALREADY_DONE")) {
      return NextResponse.json(
        { error: "Kamu sudah mengerjakan quest ini untuk peserta tersebut." },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
