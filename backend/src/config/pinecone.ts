import { Pinecone } from "@pinecone-database/pinecone";
import dotenv from "dotenv";

dotenv.config();

export const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY || "",
});

export const PINECONE_INDEX_NAME =
  process.env.PINECONE_INDEX_NAME || "url-embeddings";

export async function initPinecone(): Promise<boolean> {
  const apiKey = process.env.PINECONE_API_KEY;
  
  if (!apiKey || apiKey.trim() === "") {
    console.warn("[pinecone] PINECONE_API_KEY not set. Pinecone features will be disabled.");
    return false;
  }

  if (!PINECONE_INDEX_NAME) {
    console.warn("[pinecone] PINECONE_INDEX_NAME not set. Pinecone features will be disabled.");
    return false;
  }

  try {
    const indexList = await pinecone.listIndexes();
    const indexExists = indexList.indexes?.some(
      (index) => index.name === PINECONE_INDEX_NAME
    );

    if (!indexExists) {
      console.log(`[pinecone] Creating index: ${PINECONE_INDEX_NAME}`);
      await pinecone.createIndex({
        name: PINECONE_INDEX_NAME,
        dimension: 1536,
        metric: "cosine",
        spec: {
          serverless: {
            cloud: "aws",
            region: "us-west-2",
          },
        },
      });
      console.log(`[pinecone] Index created successfully`);
    } else {
      console.log(`[pinecone] Index ${PINECONE_INDEX_NAME} already exists`);
    }
    return true;
  } catch (error: any) {
    console.warn(`[pinecone] Initialization failed: ${error.message}`);
    console.warn("[pinecone] Pinecone features will be disabled. Server will continue without vector search.");
    return false;
  }
}
