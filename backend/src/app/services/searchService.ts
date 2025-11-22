import { generateEmbedding } from "../../services/embedding";
import { pinecone, PINECONE_INDEX_NAME } from "../../config/pinecone";
import { pool } from "../../config/database";

interface SearchCriteria {
  query: string;
  types?: string[];
  perPage: number;
  page: number;
  typeFilterText?: string;
}

const MAX_TOP_K = 1000;
const MIN_SEMANTIC_SCORE = 0.55;

import { ENV } from "../../config/env";

// Check environment variables from hardcoded config
function hasEmbeddingKey(): boolean {
  return Boolean(ENV.OPENROUTER_API_KEY);
}

function hasPineconeKey(): boolean {
  return Boolean(ENV.PINECONE_API_KEY);
}

/**
 * Normalizes a string for fuzzy matching by:
 * - Converting to lowercase
 * - Replacing hyphens, underscores, and other separators with spaces
 * - Normalizing multiple spaces to single space
 * - Trimming
 */
function normalizeForMatching(text: string): string {
  return text
    .toLowerCase()
    .replace(/[-_./\\]/g, " ") // Replace separators with spaces
    .replace(/\s+/g, " ") // Normalize multiple spaces
    .trim();
}

/**
 * Checks if normalized query matches normalized text (handles hyphens, spaces, etc.)
 */
function normalizedIncludes(normalizedQuery: string, text: string): boolean {
  const normalizedText = normalizeForMatching(text);
  return normalizedText.includes(normalizedQuery);
}

export async function executeSearch(criteria: SearchCriteria) {
  const { query, types, perPage, page, typeFilterText } = criteria;

  // Check environment variables at runtime
  const pineconeKeyAvailable = hasPineconeKey();
  const embeddingKeyAvailable = hasEmbeddingKey();

  console.log(`[search] Config check - Pinecone: ${pineconeKeyAvailable}, Embedding: ${embeddingKeyAvailable}`);
  console.log(`[search] Using hardcoded config values`);

  // ONLY use Pinecone - no database fallback
  if (!pineconeKeyAvailable) {
    console.error(`[search] ERROR: Pinecone is not configured!`);
    console.error(`[search] Please set PINECONE_API_KEY in your .env file`);
    return {
      results: [],
      meta: {
        page,
        perPage,
        totalAvailable: 0,
        degraded: true,
        reason: "Pinecone is not configured. Set PINECONE_API_KEY in .env file.",
      },
    };
  }

  // Pinecone requires embeddings to query
  if (!embeddingKeyAvailable) {
    console.error(`[search] ERROR: Embedding API key is missing!`);
    console.error(`[search] Pinecone requires embeddings to query. Please set OPENROUTER_API_KEY or OPENAI_API_KEY in .env`);
    return {
      results: [],
      meta: {
        page,
        perPage,
        totalAvailable: 0,
        degraded: true,
        reason: "Embedding API key required for Pinecone search. Set OPENROUTER_API_KEY or OPENAI_API_KEY in .env file.",
      },
    };
  }

  // Both Pinecone and embedding keys available - use Pinecone vector search
  // NEVER skip Pinecone - always try it first!
  console.log(`[search] ===== USING PINECONE VECTOR SEARCH (NOT DATABASE) =====`);
  let queryEmbedding: number[] | null = null;
  
  try {
    console.log(`[search] Step 1: Generating embedding for query: "${query}"`);
    queryEmbedding = await generateEmbedding(query);
    if (!queryEmbedding || queryEmbedding.length === 0) {
      throw new Error("Generated embedding is empty");
    }
    console.log(`[search] Step 2: Embedding generated successfully (${queryEmbedding.length} dimensions), now querying Pinecone...`);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[search] ERROR: Embedding generation failed: ${errorMessage}`);
    console.error(`[search] Cannot proceed without embeddings. Check your API keys.`);
    return {
      results: [],
      meta: {
        page,
        perPage,
        totalAvailable: 0,
        degraded: true,
        reason: `Embedding generation failed: ${errorMessage}. Check your OPENROUTER_API_KEY or OPENAI_API_KEY configuration.`,
      },
    };
  }

  try {
    console.log(`[search] Querying Pinecone index: ${PINECONE_INDEX_NAME}`);
    const index = pinecone.index(PINECONE_INDEX_NAME);

    const filter: Record<string, unknown> = {};
    if (types && types.length > 0) {
      filter.type = { $in: types };
      console.log(`[search] Applying type filter: ${types.join(", ")}`);
    }

    const topKForQuery = Math.min(
      MAX_TOP_K,
      Math.max(perPage * page, perPage * 3)
    );

    console.log(`[search] Querying Pinecone with topK: ${topKForQuery}`);
    const queryResponse = await index.query({
      vector: queryEmbedding,
      topK: topKForQuery,
      includeMetadata: true,
      filter: Object.keys(filter).length > 0 ? filter : undefined,
    });
    console.log(`[search] Pinecone returned ${queryResponse.matches?.length || 0} matches`);

    const now = new Date();
    const queryLower = query.toLowerCase();
    const normalizedQuery = normalizeForMatching(query);

    const matches = queryResponse.matches || [];

    const allResults = matches
    .map((match) => {
      const metadata = match.metadata as {
        url: string;
        type: string;
        title: string;
        snippet?: string;
        updated_at?: string;
      };

      if (!metadata?.url) {
        return null;
      }

      const originalScore = match.score || 0;
      let boostedScore = originalScore;

      const titleLower = (metadata.title || "").toLowerCase();
      const urlLower = metadata.url.toLowerCase();
      
      // Use normalized matching for better URL/title matching (handles hyphens, spaces, etc.)
      const hasTextMatch =
        normalizedIncludes(normalizedQuery, metadata.title || "") ||
        normalizedIncludes(normalizedQuery, metadata.url) ||
        titleLower.includes(queryLower) ||
        urlLower.includes(queryLower);
      const meetsSemanticThreshold = originalScore >= MIN_SEMANTIC_SCORE;

      if (!meetsSemanticThreshold && !hasTextMatch) {
        return null;
      }

      if (normalizedIncludes(normalizedQuery, metadata.title || "") || titleLower.includes(queryLower)) {
        boostedScore += 0.15;
      }

      const normalizedTitle = normalizeForMatching(metadata.title || "");
      const titleWords = normalizedTitle.split(/\s+/);
      const queryWords = normalizedQuery.split(/\s+/);
      const isExactMatch =
        normalizedTitle === normalizedQuery ||
        normalizedTitle.startsWith(normalizedQuery) ||
        titleWords[0] === queryWords[0];

      if (isExactMatch) {
        boostedScore += 0.25;
      }

      if (normalizedIncludes(normalizedQuery, metadata.url) || urlLower.includes(queryLower)) {
        boostedScore += 0.1;
        const urlPath = urlLower.split("?")[0];
        const normalizedUrlPath = normalizeForMatching(urlPath);
        if (
          normalizedUrlPath.includes(normalizedQuery) ||
          urlPath.includes(`/${queryLower}`) ||
          urlPath.includes(`/${queryLower}/`)
        ) {
          boostedScore += 0.15;
        }
      }

      let recencyBoost = 0;
      if (meetsSemanticThreshold && hasTextMatch && metadata.updated_at) {
        try {
          const updatedAt = new Date(metadata.updated_at);
          const hoursSinceUpdate =
            (now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60);

          if (hoursSinceUpdate < 24) {
            recencyBoost = Math.max(0, 0.2 * (1 - hoursSinceUpdate / 24));
          }
          if (hoursSinceUpdate < 1) {
            recencyBoost = 0.2;
          }
        } catch {}
      }

      boostedScore += recencyBoost;
      boostedScore = Math.min(boostedScore, 1.0);

      return {
        id: match.id,
        url: metadata.url,
        type: metadata.type,
        title: metadata.title,
        score: boostedScore,
        originalScore,
        recencyBoost,
        snippet: metadata.snippet,
      };
    })
    .filter((result): result is NonNullable<typeof result> => result !== null)
    .sort((a, b) => {
      if (Math.abs(b.score - a.score) > 0.001) {
        return b.score - a.score;
      }
      return (b.originalScore || 0) - (a.originalScore || 0);
    });

    let filteredResults = allResults;
    const filterValue = typeFilterText?.trim().toLowerCase();
    if (filterValue) {
      filteredResults = allResults.filter((result) => {
        const typeMatch = (result.type || "").toLowerCase().includes(filterValue);
        const urlMatch = result.url.toLowerCase().includes(filterValue);
        const titleMatch = (result.title || "").toLowerCase().includes(filterValue);
        return typeMatch || urlMatch || titleMatch;
      });
    }

    const startIndex = (page - 1) * perPage;
    const paginatedResults = filteredResults.slice(
      startIndex,
      startIndex + perPage
    );

    return {
      results: paginatedResults,
      meta: {
        page,
        perPage,
        totalAvailable: filteredResults.length,
      },
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[search] ERROR: Pinecone query failed: ${errorMessage}`);
    console.error(`[search] Cannot proceed without Pinecone. Check your Pinecone configuration.`);
    return {
      results: [],
      meta: {
        page,
        perPage,
        totalAvailable: 0,
        degraded: true,
        reason: `Pinecone query failed: ${errorMessage}. Check your PINECONE_API_KEY and index configuration.`,
      },
    };
  }
}

async function fallbackTextSearch(
  criteria: SearchCriteria & { reason?: string }
) {
  const { query, types, perPage, page, typeFilterText, reason } = criteria;
  const normalizedQuery = query.trim();
  
  // Try completed first, but if no results and query is provided, also check pending
  const whereClauses: string[] = [];
  const whereParams: any[] = [];

  if (normalizedQuery) {
    const paramIndex = whereParams.length + 1;
    // Search with original query and normalized version (hyphens/underscores as spaces)
    // The scoring logic will do precise normalized matching
    const normalizedQueryForSql = normalizedQuery.replace(/[-_]/g, " ");
    whereClauses.push(
      `(
        COALESCE(title, '') ILIKE $${paramIndex} OR 
        url ILIKE $${paramIndex} OR 
        COALESCE(contentPreview, '') ILIKE $${paramIndex} OR 
        COALESCE(type, '') ILIKE $${paramIndex} OR
        COALESCE(title, '') ILIKE $${paramIndex + 1} OR 
        url ILIKE $${paramIndex + 1}
      )`
    );
    whereParams.push(`%${normalizedQuery}%`, `%${normalizedQueryForSql}%`);
  }

  // Prefer completed URLs, but include pending if no completed matches
  // We'll handle this in the query by ordering by status

  if (types && types.length > 0) {
    const paramIndex = whereParams.length + 1;
    whereClauses.push(`type = ANY($${paramIndex})`);
    whereParams.push(types);
  }

  const baseWhere =
    whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";
  
  // Fetch all matching results (up to a reasonable limit) for scoring and filtering
  // Then paginate in memory after scoring/sorting
  const MAX_FETCH = 10000; // Reasonable upper limit
  
  const querySql = `SELECT id, url, type, title, contentPreview, updated_at, status
       FROM urls
       ${baseWhere || "WHERE 1=1"}
       ORDER BY 
         CASE WHEN status = 'completed' THEN 1 
              WHEN status = 'pending' THEN 2 
              ELSE 3 END,
         updated_at DESC NULLS LAST
       LIMIT ${MAX_FETCH}`;
  
  console.log("[search] Fallback text search query:", querySql);
  console.log("[search] Query params:", whereParams);
  console.log("[search] Search criteria:", { query: normalizedQuery, types, typeFilterText });

  const rowsResult = await pool.query(querySql, whereParams);
  
  console.log("[search] Found rows:", rowsResult.rows.length);

  const now = new Date();
  const queryLower = normalizedQuery.toLowerCase();
  const normalizedQueryForMatch = normalizeForMatching(normalizedQuery);
  const filterValue = typeFilterText?.trim().toLowerCase();

  const scoredResults = rowsResult.rows.map((row) => {
    const title = row.title || row.url;
    const snippet = row.contentpreview || "";
    const titleLower = title.toLowerCase();
    const urlLower = row.url.toLowerCase();
    const snippetLower = snippet.toLowerCase();

    let score = 0.35;
    if (normalizedQuery) {
      // Use normalized matching for better URL/title matching (handles hyphens, spaces, etc.)
      const hasNormalizedTitleMatch = normalizedIncludes(normalizedQueryForMatch, title);
      const hasNormalizedUrlMatch = normalizedIncludes(normalizedQueryForMatch, row.url);
      const hasNormalizedSnippetMatch = normalizedIncludes(normalizedQueryForMatch, snippet);
      
      // Also check regular lowercase matching for backward compatibility
      const hasTitleMatch = titleLower.includes(queryLower);
      const hasUrlMatch = urlLower.includes(queryLower);
      const hasSnippetMatch = snippetLower.includes(queryLower);
      
      if (hasNormalizedTitleMatch || hasTitleMatch) score += 0.35;
      if (hasNormalizedUrlMatch || hasUrlMatch) score += 0.2;
      if (hasNormalizedSnippetMatch || hasSnippetMatch) score += 0.15;
    }

    let recencyBoost = 0;
    if (row.updated_at) {
      const updatedAt = new Date(row.updated_at);
      const hoursSinceUpdate =
        (now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60);
      if (!Number.isNaN(hoursSinceUpdate) && hoursSinceUpdate < 72) {
        recencyBoost = Math.max(0, 0.2 * (1 - hoursSinceUpdate / 72));
      }
    }
    score = Math.min(score + recencyBoost, 1);

    return {
      id: row.id?.toString?.() ?? String(row.id),
      url: row.url,
      type: row.type,
      title,
      snippet,
      score,
      originalScore: score - recencyBoost,
      recencyBoost,
    };
  });

  // Sort by score (highest first)
  scoredResults.sort((a, b) => {
    if (Math.abs(b.score - a.score) > 0.001) {
      return b.score - a.score;
    }
    return (b.originalScore || 0) - (a.originalScore || 0);
  });

  // Apply typeFilterText if provided
  const filteredResults = filterValue
    ? scoredResults.filter((result) => {
        return (
          (result.type || "").toLowerCase().includes(filterValue) ||
          result.url.toLowerCase().includes(filterValue) ||
          (result.title || "").toLowerCase().includes(filterValue)
        );
      })
    : scoredResults;

  // Paginate after scoring and filtering
  const startIndex = (page - 1) * perPage;
  const paginatedResults = filteredResults.slice(
    startIndex,
    startIndex + perPage
  );

  return {
    results: paginatedResults,
    meta: {
      page,
      perPage,
      totalAvailable: filteredResults.length,
      degraded: true,
      reason: reason || "Using database text search (Pinecone vector search unavailable).",
    },
  };
}

