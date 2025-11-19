import api from "../../shared/api";

export interface UploadResponse {
  message: string;
  urlCount: number;
  fileName: string;
}

export interface StatusResponse {
  database: {
    pending: number;
    completed: number;
    failed: number;
    total: number;
  };
  queue: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
  };
}

export function uploadCsv(payload: { csvContent: string; fileName?: string }) {
  return api.post<UploadResponse>("/api/upload", payload);
}

export function fetchProcessingStatus() {
  return api.get<StatusResponse>("/api/status");
}
