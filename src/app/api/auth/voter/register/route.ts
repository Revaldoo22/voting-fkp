import { NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabase/server";
import { ipHashFromRequest, serverHashFromHeaders } from "@/lib/server-hash";
import { rateLimit } from "@/lib/rate-limit";
import { phoneToEmail } from "@/lib/auth";
import { normalizePhone } from "@/lib/utils";
import { voterRegisterSchema } from "@/lib/validations";

/** Voter self-registration with a password (no anonymous auth). */
export async function POST(request: Request) {
  // Rate limit: max 5 signups / 10 minutes per IP — curbs mass account farming.
  const ipKey = ipHashFromRequest(request) ?? "noip";
  if (!rateLimit(`register:${ipKey}`, 5, 10 * 60_000)) {
    return NextResponse.json(
      { error: "Terlalu banyak pendaftaran dari jaringan ini. Coba lagi nanti." },
      { status: 429 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = voterRegisterSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Data tidak valid" },
      { status: 400 }
    );
  }

  const { name, origin_school_name, school_id, voter_status, password } =
    parsed.data;
  const fingerprint = String(body?.fingerprint ?? "").trim();
  if (!fingerprint) {
    return NextResponse.json(
      { error: "Gagal mengenali perangkat. Muat ulang halaman." },
      { status: 400 }
    );
  }
  const phone = normalizePhone(parsed.data.phone_number);
  const email = phoneToEmail(phone);
  const service = createServiceSupabase();

  // 1) One WhatsApp number = one account.
  const { data: existing } = await service
    .from("profiles")
    .select("id")
    .eq("phone_number", phone)
    .maybeSingle();
  if (existing) {
    return NextResponse.json(
      { error: "Nomor WhatsApp sudah terdaftar. Silakan masuk." },
      { status: 409 }
    );
  }

  // 2) Anti-cheat: one device fingerprint may bind to only one account.
  const { data: deviceOwner } = await service
    .from("user_devices")
    .select("user_id")
    .eq("device_fingerprint", fingerprint)
    .maybeSingle();
  if (deviceOwner) {
    return NextResponse.json(
      {
        error:
          "Perangkat ini sudah terhubung dengan akun lain. Satu perangkat hanya untuk satu akun.",
      },
      { status: 409 }
    );
  }

  // 3) Create the auth user (password) via Admin API.
  const { data: created, error: createErr } =
    await service.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, role: "voter", origin_school_name, voter_status },
    });
  if (createErr || !created.user) {
    return NextResponse.json(
      { error: createErr?.message ?? "Gagal membuat akun." },
      { status: 500 }
    );
  }
  const uid = created.user.id;

  // 4) Profile.
  const { error: profErr } = await service.from("profiles").insert({
    id: uid,
    name,
    phone_number: phone,
    origin_school_name,
    school_id,
    voter_status,
    role: "voter",
    device_fingerprint: fingerprint,
  });
  if (profErr) {
    await service.auth.admin.deleteUser(uid);
    if (profErr.code === "23505") {
      return NextResponse.json(
        { error: "Nomor WhatsApp sudah digunakan." },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: profErr.message }, { status: 500 });
  }

  // 5) Bind device to this account.
  const serverHash = serverHashFromHeaders(request.headers);
  await service.from("user_devices").upsert(
    { user_id: uid, device_fingerprint: fingerprint, server_hash: serverHash },
    { onConflict: "device_fingerprint" }
  );

  return NextResponse.json({ ok: true });
}
