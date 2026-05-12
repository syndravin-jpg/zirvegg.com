import pg from 'pg';

const { Pool } = pg;

export const db = new Pool({
  connectionString: 'postgresql://admin:gizli123@localhost:5432/loltracker',
});