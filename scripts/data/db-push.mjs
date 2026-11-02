// Applies supabase/migrations to the hosted database. Run with: npm run db:push [-- --dry-run]
// Needs SUPABASE_DB_URL (Session pooler connection string) in .env.local.
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

process.loadEnvFile?.(new URL("../../.env.local", import.meta.url));
const url = process.env.SUPABASE_DB_URL;
if (!url) throw new Error("Set SUPABASE_DB_URL in .env.local (Supabase → Connect → Session pooler)");
// The CLI needs a percent-encoded URL: encode the password part only.
const m = /^(postgres(?:ql)?:\/\/[^:]+:)(.*)(@[^@]+)$/.exec(url);
const dbUrl = m ? m[1] + encodeURIComponent(decodeURIComponent(m[2])) + m[3] : url;
// Run the CLI through node directly (no shell), so the password is never parsed by a shell.
const cli = fileURLToPath(new URL("../../node_modules/supabase/dist/supabase.js", import.meta.url));
const r = spawnSync(process.execPath, [cli, "db", "push", "--db-url", dbUrl, ...process.argv.slice(2)], { stdio: "inherit" });
process.exit(r.status ?? 1);
