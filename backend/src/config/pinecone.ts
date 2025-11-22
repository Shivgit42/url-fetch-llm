import { Pinecone } from "@pinecone-database/pinecone";
import { ENV } from "./env";

export const pinecone = new Pinecone({
  apiKey: ENV.PINECONE_API_KEY,
});

export const PINECONE_INDEX_NAME = ENV.PINECONE_INDEX_NAME;

export async function initPinecone(): Promise<boolean> {
  const apiKey = ENV.PINECONE_API_KEY;
  
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
    }
    return true;
  } catch (error: any) {
    // Pinecone is optional, fail silently
    return false;
  }
}
