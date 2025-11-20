import dotenv from "dotenv";
import { urlQueue } from "./config/queue";
import { extractContentFromUrl } from "./services/contentExtractor";
import { generateEmbedding } from "./services/embedding";
import { pool, initDatabase } from "./config/database";
import { pinecone, PINECONE_INDEX_NAME, initPinecone } from "./config/pinecone";

dotenv.config();

const log = (...args: unknown[]) =>
  console.info(new Date().toISOString(), "[worker]", ...args);

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
  log(`Processing job: ${url} (type: ${type})`);

  try {
    let content;
    try {
      content = await extractContentFromUrl(url);
    } catch (error: any) {
      log(`Failed to fetch ${url}: ${error.message}. Using fallback content.`);
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
        log(`Embedding generation skipped for ${url}: ${error.message}`);
      }
    } else {
      log(`Skipping embedding generation for ${url}: no API key configured`);
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
        log(`Failed to upsert ${url} to Pinecone: ${error.message}`);
      }
    } else if (!hasPineconeKey) {
      log(`Skipping Pinecone sync for ${url}: no PINECONE_API_KEY configured`);
    }

    const result = { success: true, url, vectorSynced: Boolean(embedding && hasPineconeKey) };
    log(`Job completed successfully: ${url}${result.vectorSynced ? " (vector synced)" : ""}`);
    return result;
  } catch (error: any) {
    log(`Job failed for ${url}: ${error.message}`);
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

urlQueue.on("completed", (job) => {
  log(`Job completed: ${job.data.url}`);
});
urlQueue.on("failed", (job, err) => {
  log(`Job failed: ${job?.data?.url || "unknown"} - ${err.message}`);
});
urlQueue.on("stalled", (job) => {
  log(`Job stalled: ${job?.data?.url || "unknown"}`);
});
urlQueue.on("error", (error) => {
  log(`Queue error: ${error.message}`);
});

async function startWorker() {
  const bootStarted = Date.now();
  try {
    log("Initializing worker services: database, pinecone, redis");
    
    // Test Redis connection
    try {
      await urlQueue.getWaitingCount();
      log("Redis connection: OK");
    } catch (error: any) {
      log(`Redis connection failed: ${error.message}`);
      throw error;
    }

    // Initialize database
    await initDatabase();
    log("Database connection: OK");

    // Initialize Pinecone (if configured) - optional, won't crash if it fails
    let pineconeInitialized = false;
    if (hasPineconeKey) {
      pineconeInitialized = await initPinecone();
      if (pineconeInitialized) {
        log("Pinecone connection: OK");
      } else {
        log("Pinecone: Initialization failed - vector sync will be disabled");
      }
    } else {
      log("Pinecone: Skipped (no API key)");
    }

    const duration = Date.now() - bootStarted;
    log(`Worker ready (started in ${duration}ms)`);
    log(`Processing up to 10 jobs concurrently`);
    log(`Embedding: ${hasEmbeddingKey ? "Enabled" : "Disabled (no API key)"}`);
    log(`Pinecone: ${pineconeInitialized ? "Enabled" : "Disabled (no API key or initialization failed)"}`);
  } catch (error: any) {
    log(`Failed to start worker: ${error.message}`);
    process.exit(1);
  }
}

// Health check interval
setInterval(async () => {
  try {
    const [waiting, active, completed, failed] = await Promise.all([
      urlQueue.getWaitingCount(),
      urlQueue.getActiveCount(),
      urlQueue.getCompletedCount(),
      urlQueue.getFailedCount(),
    ]);
    log(`Queue stats - Waiting: ${waiting}, Active: ${active}, Completed: ${completed}, Failed: ${failed}`);
  } catch (error: any) {
    log(`Health check error: ${error.message}`);
  }
}, 30000); // Every 30 seconds

void startWorker();

export {};

