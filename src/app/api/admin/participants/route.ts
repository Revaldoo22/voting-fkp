import { NextResponse } from "next/server";
import { createServerSupabase, createServiceSupabase } from "@/lib/supabase/server";
import { generatePassword, phoneToEmail } from "@/lib/auth";
import { normalizePhone } from "@/lib/utils";
import { participantSchema } from "@/lib/validations";

async function requireAdmin() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const service = createServiceSupabase();
  const { data } = await service
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  return data?.role === "admin" ? user : null;
}

/** Create a participant: generates a login password + linked profile. */
export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = participantSchema.safeParse({
    ...body,
    description: body?.description ?? "",
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Data tidak valid" },
      { status: 400 }
    );
  }

  const service = createServiceSupabase();
  const phone = normalizePhone(parsed.data.phone_number);
  const email = phoneToEmail(phone);

  // Phone must be unique across all profiles.
  const { data: dupe } = await service
    .from("profiles")
    .select("id")
    .eq("phone_number", phone)
    .maybeSingle();
  if (dupe) {
    return NextResponse.json(
      { error: "Nomor WhatsApp sudah digunakan akun lain." },
      { status: 409 }
    );
  }

  // Resolve school: use existing school_id, else find-or-create by name
  // (case-insensitive). Schools are derived from participant input.
  let schoolId = parsed.data.school_id || "";
  if (!schoolId) {
    const schoolName = (parsed.data.school_name || "").trim();
    const { data: existingSchool } = await service
      .from("schools")
      .select("id")
      .ilike("name", schoolName)
      .maybeSingle();
    if (existingSchool) {
      schoolId = existingSchool.id;
    } else {
      const { data: newSchool, error: schoolErr } = await service
        .from("schools")
        .insert({ name: schoolName })
        .select("id")
        .single();
      if (schoolErr || !newSchool) {
        return NextResponse.json(
          { error: schoolErr?.message ?? "Gagal membuat sekolah." },
          { status: 500 }
        );
      }
      schoolId = newSchool.id;
    }
  }

  const password = generatePassword();

  // 1) Create the auth user (confirmed) with the generated password.
  const { data: created, error: createErr } =
    await service.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name: parsed.data.name, role: "participant" },
    });
  if (createErr || !created.user) {
    return NextResponse.json(
      { error: createErr?.message ?? "Gagal membuat akun peserta." },
      { status: 500 }
    );
  }
  const uid = created.user.id;

  // 2) Profile (role participant).
  const { error: profErr } = await service.from("profiles").insert({
    id: uid,
    name: parsed.data.name,
    phone_number: phone,
    school_id: schoolId,
    role: "participant",
  });
  if (profErr) {
    await service.auth.admin.deleteUser(uid);
    return NextResponse.json({ error: profErr.message }, { status: 500 });
  }

  // 3) Participant entity linked to the profile.
  const { data: participant, error: partErr } = await service
    .from("participants")
    .insert({
      profile_id: uid,
      name: parsed.data.name,
      school_id: schoolId,
      description: parsed.data.description || null,
      photo_url: body?.photo_url ?? null,
      status: "active",
    })
    .select()
    .single();
  if (partErr) {
    await service.auth.admin.deleteUser(uid);
    return NextResponse.json({ error: partErr.message }, { status: 500 });
  }

  // Return the generated credentials ONCE so the admin can share them.
  return NextResponse.json({
    ok: true,
    participant,
    credentials: { phone_number: phone, password },
  });
}
