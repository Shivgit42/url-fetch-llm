// Hardcoded environment variables

export const ENV = {
  DB_HOST: "ep-wispy-union-ad2t5nto-pooler.c-2.us-east-1.aws.neon.tech",
  DB_PORT: 5432,
  DB_NAME: "neondb",
  DB_USER: "neondb_owner",
  DB_PASSWORD: "npg_Ay86oaGNCKis",
  PINECONE_API_KEY:
    "pcsk_2QbPND_M5a259ah1aQmz7VeejcnifPRQtPh9jC8T9erfPWpGuPcQHn2unxxjvi9bH32hY2",
  PINECONE_INDEX_NAME: "semantic-search",
  REDIS_HOST: "localhost",
  REDIS_PORT: 6379,
  OPENROUTER_API_KEY:
    "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",
  OPENAI_API_KEY:
    "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",
  EMBEDDING_MODEL: "text-embedding-ada-002",
} as const;
