import dotenv from "dotenv";
dotenv.config();

export const ENV = {
  DB_HOST: process.env.DB_HOST!,
  DB_PORT: Number(process.env.DB_PORT) || 5432,
  DB_NAME: process.env.DB_NAME!,
  DB_USER: process.env.DB_USER!,
  DB_PASSWORD: process.env.DB_PASSWORD!,
  PINECONE_API_KEY: process.env.PINECONE_API_KEY!,
  PINECONE_INDEX_NAME: process.env.PINECONE_INDEX_NAME!,
  REDIS_HOST: process.env.REDIS_HOST || "127.0.0.1",
  REDIS_PORT: Number(process.env.REDIS_PORT) || 6379,
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY!,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY!,
  EMBEDDING_MODEL: process.env.EMBEDDING_MODEL!,
} as const;