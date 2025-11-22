import axios from 'axios';
import { ENV } from "../config/env";

console.log(`[embedding] Using hardcoded config - OPENROUTER_API_KEY: SET (${ENV.OPENROUTER_API_KEY.length} chars)`);
console.log(`[embedding] Using hardcoded config - EMBEDDING_MODEL: ${ENV.EMBEDDING_MODEL}`);

export async function generateEmbedding(text: string): Promise<number[]> {
  // Use hardcoded config values
  const OPENROUTER_API_KEY = ENV.OPENROUTER_API_KEY;
  const EMBEDDING_MODEL = ENV.EMBEDDING_MODEL;

  console.log(`[embedding] Using hardcoded config - OPENROUTER_API_KEY: SET (${OPENROUTER_API_KEY.length} chars)`);
  console.log(`[embedding] Using hardcoded config - EMBEDDING_MODEL: ${EMBEDDING_MODEL}`);

  if (OPENROUTER_API_KEY && OPENROUTER_API_KEY.length > 0) {
    try {
      console.log(`[embedding] Generating embedding using OpenRouter`);
      const response = await axios.post(
        'https://openrouter.ai/api/v1/embeddings',
        {
          model: `openai/${EMBEDDING_MODEL}`,
          input: text,
        },
        {
          headers: {
            'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'http://localhost:3000',
            'X-Title': 'URL Fetch LLM',
          },
        }
      );
      console.log(`[embedding] Successfully generated embedding using OpenRouter`);
      return response.data.data[0].embedding;
    } catch (error: unknown) {
      let errorMessage = "Unknown error";
      let statusCode: number | undefined;
      
      if (axios.isAxiosError(error)) {
        statusCode = error.response?.status;
        errorMessage = error.response?.data?.error?.message || error.message;
        
        if (statusCode === 402) {
          errorMessage = "OpenRouter API key payment required or insufficient credits. Please check your OpenRouter account balance and billing.";
        } else if (statusCode === 401) {
          errorMessage = "OpenRouter API key is invalid or expired. Please check your API key.";
        } else if (statusCode === 429) {
          errorMessage = "OpenRouter rate limit exceeded. Please try again later.";
        }
        
        console.error(`[embedding] OpenRouter embedding failed (Status ${statusCode}): ${errorMessage}`);
        if (error.response?.data) {
          console.error(`[embedding] OpenRouter error details:`, JSON.stringify(error.response.data, null, 2));
        }
      } else {
        errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[embedding] OpenRouter embedding failed: ${errorMessage}`);
      }
      
      throw new Error(`Embedding generation failed: ${errorMessage}`);
    }
  }

  // This should never happen with hardcoded config
  console.error(`[embedding] ERROR: No embedding API key available!`);
  throw new Error('No embedding API key configured');
}

