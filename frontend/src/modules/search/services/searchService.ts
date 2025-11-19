import api from "../../shared/api";

export interface SearchPayload {
  query: string;
  types?: string[];
  perPage: number;
  page: number;
  typeFilterText?: string;
}

export interface SearchResponse {
  results: any[];
  meta?: {
    page: number;
    perPage: number;
    totalAvailable: number;
  };
}

export interface TypesResponse {
  types: string[];
}

export interface RecentResponse {
  recent: Array<{
    id: number;
    url: string;
    title?: string;
    type?: string;
  }>;
}

export function performSearch(payload: SearchPayload) {
  return api.post<SearchResponse>("/api/search", payload);
}

export function fetchTypes() {
  return api.get<TypesResponse>("/api/types");
}

export function fetchRecentUrls() {
  return api.get<RecentResponse>("/api/recent-urls");
}

