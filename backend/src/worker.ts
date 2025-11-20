import dotenv from "dotenv";
import { urlQueue } from "./config/queue";
import { extractContentFromUrl } from "./services/contentExtractor";
import { generateEmbedding } from "./services/embedding";
import { pool } from "./config/database";
import { pinecone, PINECONE_INDEX_NAME } from "./config/pinecone";

dotenv.config();

interface JobData {
  url: string;
  type: string;
  id?: string;
}

const hasEmbeddingKey = Boolean(
  process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY
);
const hasPineconeKey = Boolean(process.env.PINECONE_API_KEY);

urlQueue.process(10, async (job) => {
  const { url, type }: JobData = job.data;

  try {
    let content;
    try {
      content = await extractContentFromUrl(url);
    } catch (error: any) {
      console.warn(
        `[worker] Failed to fetch ${url}: ${error.message}. Using fallback content.`
      );
      content = {
        title: url,
        textContent: `Content temporarily unavailable for ${url}`,
        htmlContent: "",
      };
    }

    const title = content.title.substring(0, 500);
    const textContent = content.textContent.substring(0, 10000);
    const preview = textContent.substring(0, 500);
    const extractedHtml = content.htmlContent || "";

    const embeddingText = `${title}\n${textContent}`;
    let embedding: number[] | null = null;

    if (hasEmbeddingKey) {
      try {
        embedding = await generateEmbedding(embeddingText);
      } catch (error: any) {
        console.warn(
          `[worker] Embedding generation skipped for ${url}: ${error.message}`
        );
      }
    } else {
      console.warn(
        `[worker] Skipping embedding generation for ${url}: no API key configured`
      );
    }

    await pool.query(
      `UPDATE urls 
       SET title = $1, contentPreview = $2, extractedContent = $3, status = 'completed', updated_at = CURRENT_TIMESTAMP
       WHERE url = $4`,
      [title, preview, extractedHtml, url]
    );

    if (embedding && hasPineconeKey) {
      try {
        const dbResult = await pool.query("SELECT id FROM urls WHERE url = $1", [
          url,
        ]);
        const dbId = dbResult.rows[0]?.id;

        if (!dbId) {
          throw new Error("Failed to find URL in database");
        }

        const timestampResult = await pool.query(
          "SELECT updated_at FROM urls WHERE id = $1",
          [dbId]
        );
        const updatedAt = timestampResult.rows[0]?.updated_at || new Date();

        const index = pinecone.index(PINECONE_INDEX_NAME);
        await index.upsert([
          {
            id: dbId.toString(),
            values: embedding,
            metadata: {
              url,
              type,
              title,
              snippet: preview,
              updated_at: updatedAt.toISOString(),
            },
          },
        ]);
      } catch (error: any) {
        console.warn(
          `[worker] Failed to upsert ${url} to Pinecone: ${error.message}`
        );
      }
    } else if (!hasPineconeKey) {
      console.warn(
        `[worker] Skipping Pinecone sync for ${url}: no PINECONE_API_KEY configured`
      );
    }

    return { success: true, url, vectorSynced: Boolean(embedding && hasPineconeKey) };
  } catch (error: any) {
    console.error(`[worker] Job failed for ${url}: ${error.message}`);
    try {
      await pool.query(
        `UPDATE urls 
         SET status = 'failed', updated_at = CURRENT_TIMESTAMP
         WHERE url = $1`,
        [url]
      );
    } catch {}

    throw error;
  }
});

urlQueue.on("completed", () => {});
urlQueue.on("failed", () => {});
urlQueue.on("stalled", () => {});
urlQueue.on("error", () => {});

setInterval(async () => {
  try {
    await Promise.all([
      urlQueue.getWaitingCount(),
      urlQueue.getActiveCount(),
      urlQueue.getCompletedCount(),
      urlQueue.getFailedCount(),
    ]);
  } catch {}
}, 10000);

export {};

