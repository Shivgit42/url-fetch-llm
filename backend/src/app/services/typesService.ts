import {
  fetchDistinctTypes,
  fetchRecentUrls,
} from "../repositories/urlRepository";

export async function getAvailableTypes() {
  const types = await fetchDistinctTypes();
  return { types };
}

export async function getRecentUrls(limit = 10) {
  const rows = await fetchRecentUrls(limit);
  return {
    recent: rows.map((row) => ({
      id: row.id,
      url: row.url,
      title: row.title,
      type: row.type,
      updatedAt: row.updated_at,
    })),
  };
}

