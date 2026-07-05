// Generate a local sign-in link without sending an email (dev only).
// Usage: node scripts/dev-login.mjs [email]
// Requires SUPABASE_SERVICE_ROLE_KEY in .env.local — bypasses the
// Supabase email rate limit by using the admin API directly.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((line) => line.includes("="))
    .map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1)])
);

const email = process.argv[2] ?? env.DEV_LOGIN_EMAIL;
if (!email) {
  console.error("Usage: node scripts/dev-login.mjs <email>");
  process.exit(1);
}
if (!env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("SUPABASE_SERVICE_ROLE_KEY missing from .env.local");
  process.exit(1);
}

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
if (error && /not found/i.test(error.message)) {
  await admin.auth.admin.createUser({ email, email_confirm: true });
  ({ data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email }));
}
if (error) {
  console.error("Error:", error.message);
  process.exit(1);
}

console.log(
  `http://localhost:3000/auth/confirm?token_hash=${data.properties.hashed_token}&type=magiclink&next=/dashboard`
);
