import { Pinecone } from "@pinecone-database/pinecone";
import dotenv from "dotenv";

dotenv.config();

export const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY || "",
});

export const PINECONE_INDEX_NAME =
  process.env.PINECONE_INDEX_NAME || "url-embeddings";

export async function initPinecone() {
  if (!PINECONE_INDEX_NAME) {
    throw new Error("PINECONE_INDEX_NAME environment variable is required");
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
  } catch (error) {
    throw error;
  }
}
