import { Pool } from "pg";

let pool: Pool | null = null;

export function getPool() {
  if (!process.env.DATABASE_URL) {
    console.log("[postgres] DATABASE_URL not set, using demo mode");
    return null;
  }
  console.log("[postgres] DATABASE_URL found, using database mode");

  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL
    });
  }

  return pool;
}
