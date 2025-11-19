import axios from "axios";

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
  return axios.post<SearchResponse>("/api/search", payload);
}

export function fetchTypes() {
  return axios.get<TypesResponse>("/api/types");
}

export function fetchRecentUrls() {
  return axios.get<RecentResponse>("/api/recent-urls");
}

