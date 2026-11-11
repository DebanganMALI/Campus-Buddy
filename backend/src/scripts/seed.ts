import { connectDb, disconnectDb } from "@scc/db";
import { env, isProd } from "../config/env.js";
import { USERS, runSeed } from "./seed-data.js";

// Demo data for local development and the hosted demo.
//   npm run db:seed                         (local, reads backend/.env)
//   npm run db:seed:prod -w @scc/backend    (hosted demo, reads backend/.env.production)
//
// Refuses to touch a production database unless SEED_ALLOW=true is set, so
// seeding the live demo is always a deliberate act.

const DEV_PASSWORD = "CampusDemo@2026";

function seedPassword(): string {
  if (isProd && process.env.SEED_ALLOW !== "true") {
    throw new Error("Refusing to seed a production database. Set SEED_ALLOW=true to confirm.");
  }
  const pw = process.env.SEED_PASSWORD ?? (isProd ? "" : DEV_PASSWORD);
  if (pw.length < 12) throw new Error("Set SEED_PASSWORD (at least 12 characters) for the demo accounts.");
  return pw;
}

async function main(): Promise<void> {
  const password = seedPassword();
  await connectDb(env.MONGO_URI, { appName: "scc-seed", autoIndex: false });
  try {
    await runSeed(password);
    console.log("\nDemo accounts (all pre-verified, status active):");
    for (const u of USERS) console.log(`  ${u.role.padEnd(18)} ${u.email}`);
    console.log(isProd ? "  password: the SEED_PASSWORD you set" : `  password: ${password}`);
  } finally {
    await disconnectDb();
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
