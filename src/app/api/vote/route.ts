import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { ipHashFromRequest, serverHashFromHeaders } from "@/lib/server-hash";
import { rateLimit } from "@/lib/rate-limit";
import { voteSchema } from "@/lib/validations";
import { voteErrorMessage } from "@/lib/vote-errors";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = voteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
  }

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: "Sesi tidak valid. Silakan login kembali." },
      { status: 401 }
    );
  }

  // Rate limit: max 10 vote attempts / minute per account.
  if (!rateLimit(`vote:${user.id}`, 10, 60_000)) {
    return NextResponse.json(
      { error: "Terlalu banyak percobaan. Coba lagi sebentar." },
      { status: 429 }
    );
  }

  const serverHash = serverHashFromHeaders(request.headers);
  const ipHash = ipHashFromRequest(request);

  // RPC runs the full anti-cheat check + point update atomically, using
  // auth.uid() from the user's session (never a client-supplied id).
  const { data, error } = await supabase.rpc("cast_daily_vote", {
    p_participant_id: parsed.data.participant_id,
    p_fingerprint: parsed.data.fingerprint,
    p_server_hash: serverHash,
    p_ip_hash: ipHash,
  });

  if (error) {
    const status =
      error.message.includes("DEVICE") ||
      error.message.includes("ALREADYVOTED") ||
      error.message.includes("IPLIMIT") ||
      error.message.includes("EVENTCLOSED")
        ? 409
        : 400;
    return NextResponse.json(
      { error: voteErrorMessage(error.message) },
      { status }
    );
  }

  return NextResponse.json({ ok: true, participant: data });
}
