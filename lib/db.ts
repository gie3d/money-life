import { Pool } from "pg";

// Survives dev hot reloads, which would otherwise open a new pool per edit.
const g = globalThis as unknown as { pgPool?: Pool };

export const pool = (g.pgPool ??= new Pool({ connectionString: process.env.DATABASE_URL }));
