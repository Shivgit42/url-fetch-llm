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
const hasEmbeddingKey = Boolean(
  process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY
);
const hasPineconeKey = Boolean(process.env.PINECONE_API_KEY);

export async function executeSearch(criteria: SearchCriteria) {
  const { query, types, perPage, page, typeFilterText } = criteria;

  const canUseVector = hasEmbeddingKey && hasPineconeKey;
  let queryEmbedding: number[] | null = null;

  if (!canUseVector) {
    console.warn(
      `[search] Falling back to text search (embeddingKey=${hasEmbeddingKey}, pineconeKey=${hasPineconeKey})`
    );
    return fallbackTextSearch({
      query,
      types,
      perPage,
      page,
      typeFilterText,
      reason: "Vector search disabled (missing API key)",
    });
  }

  try {
    queryEmbedding = await generateEmbedding(query);
  } catch (error: any) {
    console.warn(`[search] Semantic search unavailable: ${error.message}`);
    return fallbackTextSearch({
      query,
      types,
      perPage,
      page,
      typeFilterText,
      reason: error.message || "Semantic search unavailable",
    });
  }

  const index = pinecone.index(PINECONE_INDEX_NAME);

  const filter: Record<string, any> = {};
  if (types && types.length > 0) {
    filter.type = { $in: types };
  }

  const topKForQuery = Math.min(
    MAX_TOP_K,
    Math.max(perPage * page, perPage * 3)
  );

  const queryResponse = await index.query({
    vector: queryEmbedding,
    topK: topKForQuery,
    includeMetadata: true,
    filter: Object.keys(filter).length > 0 ? filter : undefined,
  });

  const now = new Date();
  const queryLower = query.toLowerCase();

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
      const hasTextMatch =
        titleLower.includes(queryLower) || urlLower.includes(queryLower);
      const meetsSemanticThreshold = originalScore >= MIN_SEMANTIC_SCORE;

      if (!meetsSemanticThreshold && !hasTextMatch) {
        return null;
      }

      if (titleLower.includes(queryLower)) {
        boostedScore += 0.15;
      }

      const titleWords = titleLower.split(/\s+/);
      const queryWords = queryLower.split(/\s+/);
      const isExactMatch =
        titleLower === queryLower ||
        titleLower.startsWith(queryLower) ||
        titleWords[0] === queryWords[0];

      if (isExactMatch) {
        boostedScore += 0.25;
      }

      if (urlLower.includes(queryLower)) {
        boostedScore += 0.1;
        const urlPath = urlLower.split("?")[0];
        if (
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
}

async function fallbackTextSearch(
  criteria: SearchCriteria & { reason?: string }
) {
  const { query, types, perPage, page, typeFilterText, reason } = criteria;
  const normalizedQuery = query.trim();
  const whereClauses = ["status = 'completed'"];
  const whereParams: any[] = [];

  if (normalizedQuery) {
    const paramIndex = whereParams.length + 1;
    whereClauses.push(
      `(COALESCE(title, '') ILIKE $${paramIndex} OR url ILIKE $${paramIndex} OR COALESCE(contentPreview, '') ILIKE $${paramIndex})`
    );
    whereParams.push(`%${normalizedQuery}%`);
  }

  if (types && types.length > 0) {
    const paramIndex = whereParams.length + 1;
    whereClauses.push(`type = ANY($${paramIndex})`);
    whereParams.push(types);
  }

  const baseWhere =
    whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";
  const offset = (page - 1) * perPage;
  const limitParamIndex = whereParams.length + 1;
  const offsetParamIndex = whereParams.length + 2;

  const [rowsResult, countResult] = await Promise.all([
    pool.query(
      `SELECT id, url, type, title, contentPreview, updated_at
       FROM urls
       ${baseWhere}
       ORDER BY updated_at DESC NULLS LAST
       LIMIT $${limitParamIndex} OFFSET $${offsetParamIndex}`,
      [...whereParams, perPage, offset]
    ),
    pool.query(
      `SELECT COUNT(*)::int AS count
       FROM urls
       ${baseWhere}`,
      whereParams
    ),
  ]);

  const now = new Date();
  const queryLower = normalizedQuery.toLowerCase();
  const filterValue = typeFilterText?.trim().toLowerCase();

  const scoredResults = rowsResult.rows.map((row) => {
    const title = row.title || row.url;
    const snippet = row.contentpreview || "";
    const titleLower = title.toLowerCase();
    const urlLower = row.url.toLowerCase();
    const snippetLower = snippet.toLowerCase();

    let score = 0.35;
    if (titleLower.includes(queryLower)) score += 0.35;
    if (urlLower.includes(queryLower)) score += 0.2;
    if (snippetLower.includes(queryLower)) score += 0.15;

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

  const filteredResults = filterValue
    ? scoredResults.filter((result) => {
        return (
          (result.type || "").toLowerCase().includes(filterValue) ||
          result.url.toLowerCase().includes(filterValue) ||
          (result.title || "").toLowerCase().includes(filterValue)
        );
      })
    : scoredResults;

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
      totalAvailable: countResult.rows[0]?.count || filteredResults.length,
      degraded: true,
      reason:
        reason ||
        "Vector search unavailable (missing embedding or Pinecone API key). Returned text-based matches.",
    },
  };
}

