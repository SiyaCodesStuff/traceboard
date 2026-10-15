import { config } from "dotenv";
import { z } from "zod";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { bankingDemo } from "./seed-data";

config({ path: ".env.local", quiet: true });
config({ quiet: true });

async function main() {
  const user = z.uuid().safeParse(process.env.SEED_USER_ID);
  if (!user.success) throw new Error("SEED_USER_ID must be an existing Supabase Auth user's UUID.");
  const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!connectionString) throw new Error("Set DIRECT_URL or DATABASE_URL before seeding.");
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  try {
    const data = bankingDemo(user.data.toLowerCase());
    const created = await db.$transaction(async (tx) => {
      // Serialize concurrent seed runs for the same deterministic project ID.
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${data.id}))::text`;
      const existing = await tx.project.findUnique({ where: { id: data.id }, select: { owner_id: true } });
      if (existing) {
        if (existing.owner_id !== data.owner_id) throw new Error("Demo project ownership does not match SEED_USER_ID.");
        return false;
      }
      await tx.project.create({ data });
      return true;
    }, { timeout: 30_000 });
    console.log(created ? "Created Online Banking App: 8 requirements, 6 stories, 10 tests. Coverage: 62.5%; gaps: 3 requirements, 2 tests, 2 stories."
      : "Online Banking App already exists; no data changed.");
  } finally {
    await db.$disconnect();
  }
}

main().catch(() => {
  // Avoid printing connection strings or credentials from database errors.
  console.error("Seed failed. Check SEED_USER_ID, the database connection, and that migrations have been applied.");
  process.exitCode = 1;
});
