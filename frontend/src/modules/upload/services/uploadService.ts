import axios from "axios";

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
  return axios.post<UploadResponse>("/api/upload", payload);
}

export function fetchProcessingStatus() {
  return axios.get<StatusResponse>("/api/status");
}

