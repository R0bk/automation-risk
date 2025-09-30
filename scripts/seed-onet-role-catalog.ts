import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import postgres from "postgres";

import { jobRole } from "@/lib/db/schema";
import { loadOnetCatalog } from "@/lib/onet/catalog";

config({ path: ".env.local" });
config();

async function main() {
  const connectionString = process.env.POSTGRES_URL;
  if (!connectionString) {
    console.error("POSTGRES_URL not set");
    process.exit(1);
  }

  const client = postgres(connectionString, { max: 1 });
  const db = drizzle(client);

  try {
    const catalog = loadOnetCatalog();
    if (catalog.length === 0) {
      console.warn("No O*NET roles found in catalog; exiting");
      return;
    }

    const batchSize = 100;
    const now = new Date();
    let upserted = 0;

    for (let index = 0; index < catalog.length; index += batchSize) {
      const batch = catalog.slice(index, index + batchSize);

      await db
        .insert(jobRole)
        .values(
          batch.map((role) => ({
            onetCode: role.code,
            title: role.title,
            normalizedTitle: role.normalizedTitle,
            parentCluster: role.parentCluster,
            metadata: role.metrics,
            updatedAt: now,
          }))
        )
        .onConflictDoUpdate({
          target: jobRole.onetCode,
          set: {
            title: sql`excluded."title"`,
            normalizedTitle: sql`excluded."normalizedTitle"`,
            parentCluster: sql`excluded."parentCluster"`,
            metadata: sql`excluded."metadata"`,
            updatedAt: sql`excluded."updatedAt"`,
          },
        });

      upserted += batch.length;
    }

    console.log(`Seeded ${upserted} O*NET roles.`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("Failed to seed O*NET roles", error);
  process.exit(1);
});
