import { pool } from "../../config/database";

export interface NormalizedUrlRow {
  url: string;
  type: string;
  id?: string;
}

export async function upsertUrls(rows: NormalizedUrlRow[]) {
  const queries = rows.map((row) =>
    pool.query(
      `INSERT INTO urls (url, type, status)
       VALUES ($1, $2, 'pending')
       ON CONFLICT (url)
       DO UPDATE SET status = 'pending', updated_at = CURRENT_TIMESTAMP`,
      [row.url, row.type]
    )
  );

  await Promise.all(queries);
}

export async function updateUrlAsCompleted(
  url: string,
  data: { title: string; contentPreview: string; extractedContent: string }
) {
  await pool.query(
    `UPDATE urls
     SET title = $1,
         contentPreview = $2,
         extractedContent = $3,
         status = 'completed',
         updated_at = CURRENT_TIMESTAMP
     WHERE url = $4`,
    [data.title, data.contentPreview, data.extractedContent, url]
  );
}

export async function markUrlFailed(url: string) {
  await pool.query(
    `UPDATE urls
     SET status = 'failed',
         updated_at = CURRENT_TIMESTAMP
     WHERE url = $1`,
    [url]
  );
}

export async function findUrlId(url: string) {
  const dbResult = await pool.query("SELECT id FROM urls WHERE url = $1", [
    url,
  ]);
  return dbResult.rows[0]?.id;
}

export async function getUrlUpdatedAt(id: number) {
  const timestampResult = await pool.query(
    "SELECT updated_at FROM urls WHERE id = $1",
    [id]
  );
  return timestampResult.rows[0]?.updated_at || new Date();
}

export async function fetchStatusAggregates() {
  const dbStats = await pool.query(`
    SELECT status, COUNT(*) as count
    FROM urls
    GROUP BY status
  `);

  const stats: Record<string, number> = {};
  dbStats.rows.forEach((row) => {
    stats[row.status] = parseInt(row.count, 10);
  });
  return stats;
}

export async function fetchDistinctTypes() {
  const result = await pool.query(`
    SELECT DISTINCT type
    FROM urls
    ORDER BY type ASC
  `);
  return result.rows.map((row) => row.type as string);
}

export async function fetchRecentUrls(limit = 10) {
  const result = await pool.query(
    `SELECT id, url, title, type, updated_at
     FROM urls
     WHERE status = 'completed'
     ORDER BY created_at DESC NULLS LAST
     LIMIT $1`,
    [limit]
  );
  return result.rows;
}
