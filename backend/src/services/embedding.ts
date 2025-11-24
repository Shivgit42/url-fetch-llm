import axios from "axios";
import { ENV } from "../config/env";

export async function generateEmbedding(text: string): Promise<number[]> {
  // Use hardcoded config values
  const OPENROUTER_API_KEY = ENV.OPENROUTER_API_KEY;
  const OPENAI_API_KEY = ENV.OPENAI_API_KEY;
  const EMBEDDING_MODEL = ENV.EMBEDDING_MODEL;

  console.log("OPENROUTER_API_KEY -> Test", ENV.OPENROUTER_API_KEY);
  console.log("OPENROUTER_API_KEY -> Test", ENV.EMBEDDING_MODEL);

  // Try OpenRouter first if available
  if (OPENROUTER_API_KEY && OPENROUTER_API_KEY.length > 0) {
    try {
      const response = await axios.post(
        "https://openrouter.ai/api/v1/embeddings",
        {
          model: 'openai/' + EMBEDDING_MODEL,
          input: text,
        },
        {
          headers: {
            Authorization: `Bearer ${OPENROUTER_API_KEY}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "http://localhost:3000",
            "X-Title": "URL Fetch LLM",
          },
        }
      );
      return response.data.data[0].embedding;
    } catch (error: unknown) {
      let errorMessage = "Unknown error";
      let statusCode: number | undefined;
      let shouldTryOpenAI = false;

      if (axios.isAxiosError(error)) {
        statusCode = error.response?.status;
        errorMessage = error.response?.data?.error?.message || error.message;

        if (statusCode === 402) {
          errorMessage =
            "OpenRouter API key payment required or insufficient credits. Please check your OpenRouter account balance and billing.";
          shouldTryOpenAI = true; // Try OpenAI as fallback
        } else if (statusCode === 401) {
          errorMessage =
            "OpenRouter API key is invalid or expired. Please check your API key.";
          shouldTryOpenAI = true; // Try OpenAI as fallback
        } else if (statusCode === 429) {
          errorMessage =
            "OpenRouter rate limit exceeded. Please try again later.";
          shouldTryOpenAI = true; // Try OpenAI as fallback
        }

        console.error(
          `[embedding] OpenRouter embedding failed (Status ${statusCode}): ${errorMessage}`
        );
        if (error.response?.data) {
          console.error(
            `[embedding] OpenRouter error details:`,
            JSON.stringify(error.response.data, null, 2)
          );
        }
      } else {
        errorMessage = error instanceof Error ? error.message : String(error);
        console.error(
          `[embedding] OpenRouter embedding failed: ${errorMessage}`
        );
        shouldTryOpenAI = true; // Try OpenAI as fallback for other errors
      }

      // Try OpenAI as fallback if OpenRouter failed and OpenAI key is available
      if (shouldTryOpenAI && OPENAI_API_KEY && OPENAI_API_KEY.length > 0) {
        try {
          const response = await axios.post(
            "https://api.openai.com/v1/embeddings",
            {
              model: EMBEDDING_MODEL,
              input: text,
            },
            {
              headers: {
                Authorization: `Bearer ${OPENAI_API_KEY}`,
                "Content-Type": "application/json",
              },
            }
          );
          return response.data.data[0].embedding;
        } catch (openaiError: unknown) {
          const openaiErrorMessage = axios.isAxiosError(openaiError)
            ? openaiError.response?.data?.error?.message || openaiError.message
            : openaiError instanceof Error
            ? openaiError.message
            : String(openaiError);
          console.error(
            `[embedding] OpenAI fallback also failed: ${openaiErrorMessage}`
          );
          throw new Error(
            `Embedding generation failed: OpenRouter failed (${errorMessage}), OpenAI fallback also failed (${openaiErrorMessage})`
          );
        }
      }

      throw new Error(`Embedding generation failed: ${errorMessage}`);
    }
  }

  // Try OpenAI directly if OpenRouter key is not available
  if (OPENAI_API_KEY && OPENAI_API_KEY.length > 0) {
    try {
      const response = await axios.post(
        "https://api.openai.com/v1/embeddings",
        {
          model: EMBEDDING_MODEL,
          input: text,
        },
        {
          headers: {
            Authorization: `Bearer ${OPENAI_API_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );
      return response.data.data[0].embedding;
    } catch (error: unknown) {
      const errorMessage = axios.isAxiosError(error)
        ? error.response?.data?.error?.message || error.message
        : error instanceof Error
        ? error.message
        : String(error);
      console.error(`[embedding] OpenAI embedding failed: ${errorMessage}`);
      throw new Error(`Embedding generation failed: ${errorMessage}`);
    }
  }

  // This should never happen with hardcoded config
  console.error(`[embedding] ERROR: No embedding API key available!`);
  throw new Error("No embedding API key configured");
}
