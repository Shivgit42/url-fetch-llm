import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || 'text-embedding-ada-002';

export async function generateEmbedding(text: string): Promise<number[]> {
  if (OPENROUTER_API_KEY) {
    try {
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
            'HTTP-Referer': process.env.OPENROUTER_HTTP_REFERER || 'http://localhost:3000',
            'X-Title': 'URL Fetch LLM',
          },
        }
      );
      return response.data.data[0].embedding;
    } catch (error: any) {}
  }

  if (OPENAI_API_KEY) {
    try {
      const response = await axios.post(
        'https://api.openai.com/v1/embeddings',
        {
          model: EMBEDDING_MODEL,
          input: text,
        },
        {
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );
      return response.data.data[0].embedding;
    } catch (error: any) {
      throw new Error(`Embedding generation failed: ${error.message}`);
    }
  }

  throw new Error('No embedding API key configured (OPENROUTER_API_KEY or OPENAI_API_KEY)');
}

