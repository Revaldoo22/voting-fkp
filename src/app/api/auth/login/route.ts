import { NextResponse } from "next/server";
import { createServerSupabase, createServiceSupabase } from "@/lib/supabase/server";
import { phoneToEmail, roleHome } from "@/lib/auth";
import { normalizePhone } from "@/lib/utils";
import { credentialLoginSchema } from "@/lib/validations";

/** Password login for admin & participant accounts. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = credentialLoginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Data tidak valid" },
      { status: 400 }
    );
  }

  const service = createServiceSupabase();
  const raw = parsed.data.identifier.trim();
  const looksLikePhone = /^[0-9+\-\s().]+$/.test(raw);

  // Resolve the identifier to a phone number (the auth key).
  let phone: string;
  if (looksLikePhone) {
    phone = normalizePhone(raw);
  } else {
    // Treat as a full name — must resolve to exactly one account.
    let q = service.from("profiles").select("phone_number, role").ilike("name", raw);
    if (parsed.data.expected_role) q = q.eq("role", parsed.data.expected_role);
    const { data: matches } = await q;
    if (!matches || matches.length === 0) {
      return NextResponse.json(
        { error: "Nama atau password salah." },
        { status: 401 }
      );
    }
    if (matches.length > 1) {
      return NextResponse.json(
        { error: "Nama ini terdaftar lebih dari satu. Gunakan nomor WhatsApp." },
        { status: 409 }
      );
    }
    phone = normalizePhone(matches[0].phone_number);
  }

  const email = phoneToEmail(phone);
  const supabase = await createServerSupabase();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: parsed.data.password,
  });

  if (error || !data.user) {
    return NextResponse.json(
      { error: "Nama/nomor atau password salah." },
      { status: 401 }
    );
  }

  // Look up the role to decide the redirect.
  const { data: profile } = await service
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .maybeSingle();

  const role = (profile?.role ?? "voter") as "admin" | "participant" | "voter";

  // If the login page targets a specific role, reject mismatches.
  const expected = parsed.data.expected_role;
  if (expected && role !== expected) {
    await supabase.auth.signOut();
    return NextResponse.json(
      {
        error:
          expected === "admin"
            ? "Akun ini bukan admin."
            : "Akun ini bukan peserta. Gunakan halaman login yang sesuai.",
      },
      { status: 403 }
    );
  }

  return NextResponse.json({ ok: true, redirect: roleHome(role) });
}
