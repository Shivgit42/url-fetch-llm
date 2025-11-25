import { Pool } from "pg";
import { ENV } from "./env";

export const pool = new Pool({
  host: ENV.DB_HOST,
  port: ENV.DB_PORT,
  database: ENV.DB_NAME,
  user: ENV.DB_USER,
  password: ENV.DB_PASSWORD,
  ssl: true,
});

export async function initDatabase() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS urls (
        id SERIAL PRIMARY KEY,
        url TEXT NOT NULL,
        type TEXT NOT NULL,
        title TEXT,
        contentPreview TEXT,
        extractedContent TEXT,
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      DO $$ 
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'urls' AND column_name = 'batch_id'
        ) THEN
          ALTER TABLE urls ALTER COLUMN batch_id DROP NOT NULL;
        END IF;
      END $$;
    `);

    await client.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint 
          WHERE conname = 'urls_url_key' 
          AND conrelid = 'urls'::regclass
        ) THEN
          ALTER TABLE urls ADD CONSTRAINT urls_url_key UNIQUE (url);
        END IF;
      END $$;
    `);

    await client.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'urls' AND column_name = 'extractedcontent'
        ) THEN
          ALTER TABLE urls ADD COLUMN extractedContent TEXT;
        END IF;
      END $$;
    `);

    await client.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'urls' AND column_name = 'fulltextcontent'
        ) THEN
          ALTER TABLE urls ADD COLUMN fullTextContent TEXT;
        END IF;
      END $$;
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_urls_status ON urls(status);
      CREATE INDEX IF NOT EXISTS idx_urls_type ON urls(type);
      CREATE INDEX IF NOT EXISTS idx_urls_url ON urls(url);
    `);
  } catch (error) {
    throw error;
  } finally {
    client.release();
  }
}
