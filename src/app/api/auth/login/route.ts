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

  const phone = normalizePhone(parsed.data.phone_number);
  const email = phoneToEmail(phone);
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

  // Look up the role to decide the redirect.
  const service = createServiceSupabase();
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
