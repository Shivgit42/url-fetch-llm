import { generateEmbedding } from "../../services/embedding";
import { pinecone, PINECONE_INDEX_NAME } from "../../config/pinecone";

interface SearchCriteria {
  query: string;
  types?: string[];
  perPage: number;
  page: number;
  typeFilterText?: string;
}

const MAX_TOP_K = 1000;
const MIN_SEMANTIC_SCORE = 0.55;

export async function executeSearch(criteria: SearchCriteria) {
  const { query, types, perPage, page, typeFilterText } = criteria;
  const queryEmbedding = await generateEmbedding(query);
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

