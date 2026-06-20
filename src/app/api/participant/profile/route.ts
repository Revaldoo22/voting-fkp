import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabase, createServiceSupabase } from "@/lib/supabase/server";

const schema = z.object({
  description: z.string().trim().max(1000).nullable().optional(),
});

/** A participant updates their own description. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Data tidak valid." }, { status: 400 });
  }

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sesi tidak valid." }, { status: 401 });
  }

  const service = createServiceSupabase();
  const { data, error } = await service
    .from("participants")
    .update({ description: parsed.data.description || null })
    .eq("profile_id", user.id)
    .select("id")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data)
    return NextResponse.json(
      { error: "Akun ini tidak tertaut dengan peserta." },
      { status: 404 }
    );

  return NextResponse.json({ ok: true });
}
