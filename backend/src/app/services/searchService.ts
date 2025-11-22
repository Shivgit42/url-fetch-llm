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
const MIN_SEMANTIC_SCORE_WITHOUT_TEXT_MATCH = 0.65; // Slightly higher threshold if no text match, but allow semantic matches

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
        reason:
          "Pinecone is not configured. Set PINECONE_API_KEY in .env file.",
      },
    };
  }

  // Pinecone requires embeddings to query
  if (!embeddingKeyAvailable) {
    console.error(`[search] ERROR: Embedding API key is missing!`);
    console.error(
      `[search] Pinecone requires embeddings to query. Please set OPENROUTER_API_KEY or OPENAI_API_KEY in .env`
    );
    return {
      results: [],
      meta: {
        page,
        perPage,
        totalAvailable: 0,
        degraded: true,
        reason:
          "Embedding API key required for Pinecone search. Set OPENROUTER_API_KEY or OPENAI_API_KEY in .env file.",
      },
    };
  }

  // Both Pinecone and embedding keys available - use Pinecone vector search
  // NEVER skip Pinecone - always try it first!
  let queryEmbedding: number[] | null = null;

  try {
    queryEmbedding = await generateEmbedding(query);
    if (!queryEmbedding || queryEmbedding.length === 0) {
      throw new Error("Generated embedding is empty");
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(
      `[search] ERROR: Embedding generation failed: ${errorMessage}`
    );
    console.error(
      `[search] Cannot proceed without embeddings. Check your API keys.`
    );
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
    const index = pinecone.index(PINECONE_INDEX_NAME);

    const filter: Record<string, unknown> = {};
    if (types && types.length > 0) {
      filter.type = { $in: types };
    }

    // Fetch significantly more results from Pinecone to account for:
    // 1. Results filtered out (low scores, generic content, etc.)
    // 2. Duplicate URLs that get deduplicated
    // 3. Results that don't meet semantic thresholds
    // We need a large multiplier to ensure we have enough after filtering
    // For page 1: fetch at least 5x perPage, for later pages: fetch enough for current page + buffer
    const multiplier = page === 1 ? 5 : 3;
    const topKForQuery = Math.min(
      MAX_TOP_K,
      Math.max(perPage * page * multiplier, perPage * 5) // Fetch 3-5x more to account for filtering/deduplication
    );
    
    const queryResponse = await index.query({
      vector: queryEmbedding,
      topK: topKForQuery,
      includeMetadata: true,
      filter: Object.keys(filter).length > 0 ? filter : undefined,
    });

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
        const snippetLower = (metadata.snippet || "").toLowerCase();

        // Use normalized matching for better URL/title matching (handles hyphens, spaces, etc.)
        const hasTextMatch =
          normalizedIncludes(normalizedQuery, metadata.title || "") ||
          normalizedIncludes(normalizedQuery, metadata.url) ||
          normalizedIncludes(normalizedQuery, metadata.snippet || "") ||
          titleLower.includes(queryLower) ||
          urlLower.includes(queryLower) ||
          snippetLower.includes(queryLower);

        // Require slightly higher semantic score if there's no text match at all
        // But trust semantic similarity - semantically related terms (like "guitar" for "instrument") should pass
        const requiredSemanticScore = hasTextMatch
          ? MIN_SEMANTIC_SCORE
          : MIN_SEMANTIC_SCORE_WITHOUT_TEXT_MATCH;
        const meetsSemanticThreshold = originalScore >= requiredSemanticScore;

        // Filter out results that don't meet the threshold
        if (!meetsSemanticThreshold && !hasTextMatch) {
          return null;
        }

        // Filter out results with very short snippets AND very short titles AND no text match AND very low semantic score
        // Only filter if all conditions are met (very strict) - this catches truly empty/irrelevant pages
        const snippetLength = (metadata.snippet || "").trim().length;
        const titleLength = (metadata.title || "").trim().length;
        if (
          snippetLength < 10 &&
          titleLength < 5 &&
          !hasTextMatch &&
          originalScore < 0.6
        ) {
          // If snippet is too short, title is too short, no text match, AND very low semantic score, likely irrelevant
          return null;
        }

        // Detect generic/boilerplate content patterns
        const snippetText = (metadata.snippet || "").toLowerCase();
        const titleText = (metadata.title || "").toLowerCase();
        const urlText = metadata.url.toLowerCase();

        // Check if title is just the URL (generic/empty title)
        const titleIsJustUrl =
          titleText === urlText ||
          titleText === urlText.replace(/^https?:\/\//, "").replace(/\/$/, "");

        const isGenericContent =
          snippetText.includes("wordpress") ||
          snippetText.includes("wp-blog-header") ||
          snippetText.includes("content temporarily unavailable") ||
          snippetText.includes("<?php") ||
          snippetText.length < 30 || // Very short snippets are likely generic
          (snippetText.length < 100 && !hasTextMatch) || // Short snippet without text match
          titleIsJustUrl; // Title is just the URL (no real title)

        // Apply penalties for results without text match
        // Heavily penalize generic/boilerplate content even with high semantic scores
        if (!hasTextMatch) {
          if (isGenericContent) {
            // Generic/boilerplate content without text match - heavily penalize
            boostedScore = originalScore * 0.5; // 50% penalty - push these way down
          } else if (originalScore >= 0.75) {
            // High semantic score with real content - trust it, just a tiny penalty
            boostedScore = originalScore * 0.98; // Very small penalty (2%) to slightly prefer text matches
          } else if (originalScore >= 0.65) {
            // Medium-high semantic score - apply moderate penalty
            boostedScore = originalScore * 0.88; // Moderate penalty (12%)
          } else {
            // Lower semantic score without text match - apply larger penalty
            boostedScore = originalScore * 0.8; // Larger penalty (20%)
          }
        }

        // Boost for title matches - more aggressive for keyword relevance
        const hasTitleMatch =
          normalizedIncludes(normalizedQuery, metadata.title || "") ||
          titleLower.includes(queryLower);
        if (hasTitleMatch) {
          boostedScore += 0.25; // Increased from 0.15
        }

        const normalizedTitle = normalizeForMatching(metadata.title || "");
        const titleWords = normalizedTitle.split(/\s+/);
        const queryWords = normalizedQuery.split(/\s+/);
        const isExactMatch =
          normalizedTitle === normalizedQuery ||
          normalizedTitle.startsWith(normalizedQuery) ||
          titleWords[0] === queryWords[0];

        if (isExactMatch) {
          boostedScore += 0.35; // Increased from 0.25
        }

        // Boost for snippet/content matches - important for relevance
        const hasSnippetMatch =
          normalizedIncludes(normalizedQuery, metadata.snippet || "") ||
          snippetLower.includes(queryLower);
        if (hasSnippetMatch) {
          boostedScore += 0.2; // New boost for snippet matches
        }

        // Boost for URL matches
        if (
          normalizedIncludes(normalizedQuery, metadata.url) ||
          urlLower.includes(queryLower)
        ) {
          boostedScore += 0.15; // Increased from 0.1
          const urlPath = urlLower.split("?")[0];
          const normalizedUrlPath = normalizeForMatching(urlPath);
          if (
            normalizedUrlPath.includes(normalizedQuery) ||
            urlPath.includes(`/${queryLower}`) ||
            urlPath.includes(`/${queryLower}/`)
          ) {
            boostedScore += 0.2; // Increased from 0.15
          }
        }

        // Additional boost when semantic score is high AND there's a text match (strong relevance)
        if (meetsSemanticThreshold && hasTextMatch && originalScore > 0.7) {
          boostedScore += 0.15; // Extra boost for high semantic + text match
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

    // Deduplicate by URL - keep only the highest scoring instance of each URL
    const urlMap = new Map<string, (typeof allResults)[0]>();
    for (const result of allResults) {
      const normalizedUrl = result.url.toLowerCase().replace(/\/$/, ""); // Normalize URL (remove trailing slash)
      const existing = urlMap.get(normalizedUrl);
      if (!existing || result.score > existing.score) {
        urlMap.set(normalizedUrl, result);
      }
    }
    const deduplicatedResults = Array.from(urlMap.values());

    // Re-sort deduplicated results to ensure proper ordering
    deduplicatedResults.sort((a, b) => {
      if (Math.abs(b.score - a.score) > 0.001) {
        return b.score - a.score;
      }
      return (b.originalScore || 0) - (a.originalScore || 0);
    });

    let filteredResults = deduplicatedResults;
    const filterValue = typeFilterText?.trim().toLowerCase();
    if (filterValue) {
      filteredResults = deduplicatedResults.filter((result) => {
        const typeMatch = (result.type || "")
          .toLowerCase()
          .includes(filterValue);
        const urlMatch = result.url.toLowerCase().includes(filterValue);
        const titleMatch = (result.title || "")
          .toLowerCase()
          .includes(filterValue);
        return typeMatch || urlMatch || titleMatch;
      });
    }

    const startIndex = (page - 1) * perPage;
    // Calculate the exact end index - never exceed perPage results
    const maxEndIndex = startIndex + perPage;
    const endIndex = Math.min(maxEndIndex, filteredResults.length);
    
    // Get the paginated results
    const paginatedResults = filteredResults.slice(startIndex, endIndex);

    // CRITICAL: Strictly enforce perPage limit - take exactly perPage or fewer
    // Remove any null/undefined entries first
    const cleanPaginatedResults = paginatedResults.filter(r => r != null);
    
    // Take exactly perPage items, no more
    const finalResults = cleanPaginatedResults.slice(0, perPage);
    
    // ABSOLUTE FINAL CHECK: Force truncate if we have more than perPage
    if (finalResults.length > perPage) {
      console.error(`[search] ERROR: finalResults.length (${finalResults.length}) > perPage (${perPage}), force truncating!`);
      finalResults.splice(perPage);
    }

    return {
      results: finalResults,
      meta: {
        page,
        perPage,
        totalAvailable: filteredResults.length,
      },
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[search] ERROR: Pinecone query failed: ${errorMessage}`);
    console.error(
      `[search] Cannot proceed without Pinecone. Check your Pinecone configuration.`
    );
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

  const rowsResult = await pool.query(querySql, whereParams);

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
      const hasNormalizedTitleMatch = normalizedIncludes(
        normalizedQueryForMatch,
        title
      );
      const hasNormalizedUrlMatch = normalizedIncludes(
        normalizedQueryForMatch,
        row.url
      );
      const hasNormalizedSnippetMatch = normalizedIncludes(
        normalizedQueryForMatch,
        snippet
      );

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
  const endIndex = Math.min(startIndex + perPage, filteredResults.length);
  const paginatedResults = filteredResults.slice(startIndex, endIndex);

  // Ensure we only return exactly perPage results (or fewer if not enough available)
  const finalResults = paginatedResults.slice(0, perPage);

  return {
    results: finalResults,
    meta: {
      page,
      perPage,
      totalAvailable: filteredResults.length,
      degraded: true,
      reason:
        reason ||
        "Using database text search (Pinecone vector search unavailable).",
    },
  };
}
