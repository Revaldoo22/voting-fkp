import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabase, createServiceSupabase } from "@/lib/supabase/server";

const schema = z.object({
  event_open: z.boolean().optional(),
  closed_message: z.string().max(300).optional(),
  ip_daily_limit: z.number().int().min(1).max(1000).optional(),
});

export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Sesi tidak valid." }, { status: 401 });

  const service = createServiceSupabase();
  const { data: prof } = await service
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (prof?.role !== "admin")
    return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });

  const { error } = await service
    .from("app_settings")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", true);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
