import dotenv from "dotenv";
import type { Job } from "bull";
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

void urlQueue.process(10, async (job: Job<JobData>) => {
  const { url, type } = job.data;
  log(`Processing job: ${url} (type: ${type})`);

  try {
    let content;
    try {
      content = await extractContentFromUrl(url);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log(`Failed to fetch ${url}: ${errorMessage}. Using fallback content.`);
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
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        log(`Embedding generation skipped for ${url}: ${errorMessage}`);
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
        const dbResult = await pool.query<{ id: number }>("SELECT id FROM urls WHERE url = $1", [
          url,
        ]);
        const dbId = dbResult.rows[0]?.id;

        if (!dbId) {
          throw new Error("Failed to find URL in database");
        }

        const timestampResult = await pool.query<{ updated_at: Date }>(
          "SELECT updated_at FROM urls WHERE id = $1",
          [dbId]
        );
        const updatedAt = timestampResult.rows[0]?.updated_at || new Date();

        const index = pinecone.index(PINECONE_INDEX_NAME);
        await index.upsert([
          {
            id: String(dbId),
            values: embedding,
            metadata: {
              url,
              type,
              title,
              snippet: preview,
              updated_at: updatedAt instanceof Date ? updatedAt.toISOString() : new Date(updatedAt).toISOString(),
            },
          },
        ]);
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        log(`Failed to upsert ${url} to Pinecone: ${errorMessage}`);
      }
    } else if (!hasPineconeKey) {
      log(`Skipping Pinecone sync for ${url}: no PINECONE_API_KEY configured`);
    }

    const result = { success: true, url, vectorSynced: Boolean(embedding && hasPineconeKey) };
    log(`Job completed successfully: ${url}${result.vectorSynced ? " (vector synced)" : ""}`);
    return result;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log(`Job failed for ${url}: ${errorMessage}`);
    try {
      await pool.query(
        `UPDATE urls 
         SET status = 'failed', updated_at = CURRENT_TIMESTAMP
         WHERE url = $1`,
        [url]
      );
    } catch (updateError: unknown) {
      const updateErrorMessage = updateError instanceof Error ? updateError.message : String(updateError);
      log(`Failed to update URL status to failed: ${updateErrorMessage}`);
    }

    throw error;
  }
});

urlQueue.on("completed", (job) => {
  const jobData = job.data as JobData;
  log(`Job completed: ${jobData.url}`);
});
urlQueue.on("failed", (job, err) => {
  const jobData = job?.data as JobData | undefined;
  const url = jobData?.url || "unknown";
  const errorMessage = err instanceof Error ? err.message : String(err);
  log(`Job failed: ${url} - ${errorMessage}`);
});
urlQueue.on("stalled", (job) => {
  const jobData = job?.data as JobData | undefined;
  log(`Job stalled: ${jobData?.url || "unknown"}`);
});
urlQueue.on("error", (error: unknown) => {
  const errorMessage = error instanceof Error ? error.message : String(error);
  log(`Queue error: ${errorMessage}`);
});

async function startWorker() {
  const bootStarted = Date.now();
  try {
    log("Initializing worker services: database, pinecone, redis");
    
    // Test Redis connection
    try {
      await urlQueue.getWaitingCount();
      log("Redis connection: OK");
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log(`Redis connection failed: ${errorMessage}`);
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
        log("Pinecone: Enabled");
      }
      // If initialization failed, initPinecone already logged the message
    }

    const duration = Date.now() - bootStarted;
    log(`Worker ready (started in ${duration}ms)`);
    log(`Processing up to 10 jobs concurrently`);
    log(`Embedding: ${hasEmbeddingKey ? "Enabled" : "Disabled (no API key)"}`);
    if (pineconeInitialized) {
      log(`Pinecone: Enabled`);
    } else {
      log(`Pinecone: Disabled (optional - vector search unavailable)`);
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log(`Failed to start worker: ${errorMessage}`);
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
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log(`Health check error: ${errorMessage}`);
  }
}, 30000); // Every 30 seconds

void startWorker();

export {};

