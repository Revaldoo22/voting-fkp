// Create (or reset) the admin account via the Supabase Admin API.
// Usage: npm run seed:admin  [phone] [password]
// Defaults: 081200000000 / admin123
//
// Reads NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from .env.local.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

// minimal .env.local loader (no dotenv dependency)
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^\s*([\w.]+)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

// Usage: npm run seed:admin [phone] [password] [name]
const phone = (process.argv[2] || "08888555591").replace(/[\s\-().]/g, "");
const password = process.argv[3] || "fkp@2026";
const name = process.argv[4] || "admin";
const email = `${phone}@stekom.local`;

const s = createClient(url, key, { auth: { persistSession: false } });

async function findUserByEmail(targetEmail) {
  let page = 1;
  while (true) {
    const { data, error } = await s.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = data.users.find((u) => u.email === targetEmail);
    if (hit) return hit;
    if (data.users.length < 200) return null;
    page++;
  }
}

const run = async () => {
  // Remove ALL existing admins (replace with the single new admin).
  const { data: oldAdmins } = await s
    .from("profiles")
    .select("id")
    .eq("role", "admin");
  for (const a of oldAdmins ?? []) {
    await s.from("profiles").delete().eq("id", a.id);
    try {
      await s.auth.admin.deleteUser(a.id);
    } catch {
      /* ignore */
    }
  }
  if ((oldAdmins ?? []).length) {
    console.log(`Removed ${oldAdmins.length} existing admin(s).`);
  }

  // Clean up any leftover account for this email/phone.
  const existing = await findUserByEmail(email);
  if (existing) {
    await s.from("profiles").delete().eq("id", existing.id);
    await s.auth.admin.deleteUser(existing.id);
  }
  await s.from("profiles").delete().eq("phone_number", phone);

  const { data, error } = await s.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name, role: "admin" },
  });
  if (error) {
    console.error("createUser failed:", error.message || error);
    console.error(
      "If status 500, a stale auth.users row for this email likely exists. " +
        "Delete it in Supabase SQL Editor:\n" +
        `  delete from auth.identities where user_id = (select id from auth.users where email='${email}');\n` +
        `  delete from auth.users where email='${email}';`
    );
    process.exit(1);
  }

  const uid = data.user.id;
  const { error: pe } = await s
    .from("profiles")
    .upsert({ id: uid, name, phone_number: phone, role: "admin" });
  if (pe) {
    console.error("profile upsert failed:", pe.message);
    process.exit(1);
  }

  console.log(`✅ Admin ready.\n   Login: ${phone}\n   Password: ${password}\n   (/login/admin)`);
};

run();
