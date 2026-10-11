import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "~/db/schema";

export type Database = NodePgDatabase<typeof schema>;

const globalForDb = global as unknown as {
  db: Database | undefined;
};
const db =
  globalForDb.db ||
  drizzle({
    client: new Pool({ connectionString: process.env.DATABASE_URL! }),
    schema,
  });
if (process.env.NODE_ENV !== "production") globalForDb.db = db;
export default db;
