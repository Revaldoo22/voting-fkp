import { NextResponse } from "next/server";
import { createServerSupabase, createServiceSupabase } from "@/lib/supabase/server";
import { serverHashFromHeaders } from "@/lib/server-hash";
import { phoneToEmail } from "@/lib/auth";
import { normalizePhone } from "@/lib/utils";
import { voterSignInSchema } from "@/lib/validations";

/** Voter sign-in with WhatsApp number + password. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = voterSignInSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Data tidak valid" },
      { status: 400 }
    );
  }

  const phone = normalizePhone(parsed.data.phone_number);
  const fingerprint = String(body?.fingerprint ?? "").trim();
  if (!fingerprint) {
    return NextResponse.json(
      { error: "Gagal mengenali perangkat. Muat ulang halaman." },
      { status: 400 }
    );
  }
  const email = phoneToEmail(phone);
  const service = createServiceSupabase();

  // Anti-cheat: if this device is bound to a different account, block.
  const { data: deviceOwner } = await service
    .from("user_devices")
    .select("user_id")
    .eq("device_fingerprint", fingerprint)
    .maybeSingle();

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: parsed.data.password,
  });
  if (error || !data.user) {
    return NextResponse.json(
      { error: "Nomor WhatsApp atau password salah." },
      { status: 401 }
    );
  }

  // Must be a voter account.
  const { data: profile } = await service
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .maybeSingle();
  if (profile?.role !== "voter") {
    await supabase.auth.signOut();
    return NextResponse.json(
      { error: "Akun ini bukan voter. Gunakan halaman login yang sesuai." },
      { status: 403 }
    );
  }

  if (deviceOwner && deviceOwner.user_id !== data.user.id) {
    await supabase.auth.signOut();
    return NextResponse.json(
      {
        error:
          "Perangkat ini sudah terhubung dengan akun lain. Satu perangkat hanya untuk satu akun.",
      },
      { status: 409 }
    );
  }

  // Bind device to this account (idempotent).
  const serverHash = serverHashFromHeaders(request.headers);
  await service.from("user_devices").upsert(
    {
      user_id: data.user.id,
      device_fingerprint: fingerprint,
      server_hash: serverHash,
    },
    { onConflict: "device_fingerprint" }
  );

  return NextResponse.json({ ok: true, redirect: "/voter/dashboard" });
}
