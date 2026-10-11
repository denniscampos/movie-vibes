import { PGlite } from "@electric-sql/pglite";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { fileURLToPath } from "node:url";
import * as schema from "~/db/schema";

const migrationsFolder = fileURLToPath(new URL("../../drizzle", import.meta.url));

/**
 * An in-process Postgres with the real migrations applied. Tests swap it in
 * for `~/db.server` so the model layer runs real SQL:
 *
 *   vi.mock("~/db.server", async () => ({
 *     default: await (await import("./helpers/test-db")).createTestDb(),
 *   }));
 */
export async function createTestDb() {
  const db = drizzle({ client: new PGlite(), schema });
  await migrate(db, { migrationsFolder, migrationsSchema: "public" });
  return db;
}

export type TestDb = Awaited<ReturnType<typeof createTestDb>>;

export async function resetTestDb(db: TestDb) {
  await db.execute(sql`TRUNCATE "Movie", "Category"`);
}

/** Inserts a category and the given movies in it; returns the category id. */
export async function seedMovies(
  db: TestDb,
  movies: Array<
    Partial<typeof schema.movie.$inferInsert> & { movieName: string }
  >,
  categoryName = "",
) {
  const [{ id: categoryId }] = await db
    .insert(schema.category)
    .values({ name: categoryName })
    .returning({ id: schema.category.id });
  if (movies.length > 0) {
    await db.insert(schema.movie).values(
      movies.map((m) => ({
        releaseDate: "2010",
        selectedBy: "Dennis",
        ...m,
        categoryId,
      })),
    );
  }
  return categoryId;
}
