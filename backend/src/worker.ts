import { urlQueue } from "./config/queue";
import { extractContentFromUrl } from "./services/contentExtractor";
import { generateEmbedding } from "./services/embedding";
import { pool } from "./config/database";
import { pinecone, PINECONE_INDEX_NAME } from "./config/pinecone";

interface JobData {
  url: string;
  type: string;
  id?: string;
}

urlQueue.process(10, async (job) => {
  const { url, type }: JobData = job.data;

  try {
    const content = await extractContentFromUrl(url);
    const title = content.title.substring(0, 500);
    const textContent = content.textContent.substring(0, 10000);
    const preview = textContent.substring(0, 500);
    const extractedHtml = content.htmlContent || "";

    const embeddingText = `${title}\n${textContent}`;
    const embedding = await generateEmbedding(embeddingText);

    await pool.query(
      `UPDATE urls 
       SET title = $1, contentPreview = $2, extractedContent = $3, status = 'completed', updated_at = CURRENT_TIMESTAMP
       WHERE url = $4`,
      [title, preview, extractedHtml, url]
    );

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

    return { success: true, url };
  } catch (error: any) {
    try {
      await pool.query(
        `UPDATE urls 
         SET status = 'failed', updated_at = CURRENT_TIMESTAMP
         WHERE url = $1`,
        [url]
      );
    } catch {}

    return { success: false, url, error: error.message };
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

