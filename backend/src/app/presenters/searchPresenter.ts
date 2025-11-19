import { Request, Response } from "express";
import { executeSearch } from "../services/searchService";

export async function handleSearch(req: Request, res: Response) {
  try {
    const { query, types, perPage = 20, page = 1, typeFilterText } = req.body;

    if (!query || typeof query !== "string") {
      return res.status(400).json({ error: "query is required" });
    }

    const result = await executeSearch({
      query: query.trim(),
      types,
      perPage: Math.min(Math.max(perPage, 1), 500),
      page: Math.max(1, page),
      typeFilterText,
    });

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Search failed" });
  }
}
