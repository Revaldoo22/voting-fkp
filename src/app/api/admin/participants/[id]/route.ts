import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabase, createServiceSupabase } from "@/lib/supabase/server";
import { generatePassword } from "@/lib/auth";

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

const updateSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  school_id: z.string().uuid().optional(),
  school_name: z.string().trim().min(2).max(150).optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  photo_url: z.string().url().nullable().optional(),
  status: z.enum(["active", "inactive"]).optional(),
  reset_password: z.boolean().optional(),
  new_password: z.string().min(6).max(72).optional(),
});

/** PATCH: edit participant fields and/or reset its login password. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await requireAdmin()))
    return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Data tidak valid" },
      { status: 400 }
    );
  }
  const service = createServiceSupabase();

  // Load participant (need profile_id for password reset).
  const { data: participant } = await service
    .from("participants")
    .select("id, profile_id")
    .eq("id", id)
    .maybeSingle();
  if (!participant) {
    return NextResponse.json({ error: "Peserta tidak ditemukan." }, { status: 404 });
  }

  // Resolve school (existing id or find-or-create by name).
  let schoolId = parsed.data.school_id;
  if (!schoolId && parsed.data.school_name) {
    const name = parsed.data.school_name.trim();
    const { data: existing } = await service
      .from("schools")
      .select("id")
      .ilike("name", name)
      .maybeSingle();
    if (existing) schoolId = existing.id;
    else {
      const { data: created, error } = await service
        .from("schools")
        .insert({ name })
        .select("id")
        .single();
      if (error || !created)
        return NextResponse.json(
          { error: error?.message ?? "Gagal membuat sekolah." },
          { status: 500 }
        );
      schoolId = created.id;
    }
  }

  const patch: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) patch.name = parsed.data.name;
  if (schoolId) patch.school_id = schoolId;
  if (parsed.data.description !== undefined)
    patch.description = parsed.data.description || null;
  if (parsed.data.photo_url !== undefined) patch.photo_url = parsed.data.photo_url;
  if (parsed.data.status !== undefined) patch.status = parsed.data.status;

  if (Object.keys(patch).length > 0) {
    const { error } = await service
      .from("participants")
      .update(patch)
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    // Keep the linked profile name/school in sync.
    if ((patch.name || patch.school_id) && participant.profile_id) {
      await service
        .from("profiles")
        .update({
          ...(patch.name ? { name: patch.name } : {}),
          ...(patch.school_id ? { school_id: patch.school_id } : {}),
        })
        .eq("id", participant.profile_id);
    }
  }

  // Optional password change: admin-typed password OR auto-generated.
  let newPassword: string | undefined;
  if (
    (parsed.data.new_password || parsed.data.reset_password) &&
    participant.profile_id
  ) {
    newPassword = parsed.data.new_password || generatePassword();
    const { error } = await service.auth.admin.updateUserById(
      participant.profile_id,
      { password: newPassword }
    );
    if (error)
      return NextResponse.json(
        { error: "Gagal mengubah password: " + error.message },
        { status: 500 }
      );
  }

  return NextResponse.json({ ok: true, password: newPassword });
}

/** DELETE: remove participant + linked auth account + cascading data. */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await requireAdmin()))
    return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });

  const { id } = await params;
  const service = createServiceSupabase();

  const { data: participant } = await service
    .from("participants")
    .select("id, profile_id")
    .eq("id", id)
    .maybeSingle();
  if (!participant) {
    return NextResponse.json({ error: "Peserta tidak ditemukan." }, { status: 404 });
  }

  // participants.profile_id is ON DELETE SET NULL, so deleting the auth user
  // alone would orphan the participant row. Delete the participant first
  // (its votes/submissions cascade), then the linked auth account + profile.
  const { error: delErr } = await service
    .from("participants")
    .delete()
    .eq("id", id);
  if (delErr)
    return NextResponse.json({ error: delErr.message }, { status: 500 });

  if (participant.profile_id) {
    // Cascades to profile + any votes/submissions made under that account.
    await service.auth.admin.deleteUser(participant.profile_id);
  }

  return NextResponse.json({ ok: true });
}
