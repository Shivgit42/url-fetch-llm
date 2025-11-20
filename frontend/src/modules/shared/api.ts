import axios from "axios";

// When served from backend (production), use relative URLs
// When in dev mode with separate frontend server, use VITE_API_BASE_URL or default to empty (relative)
const rawBaseUrl = import.meta.env.VITE_API_BASE_URL;
const normalizedBaseUrl = rawBaseUrl ? rawBaseUrl.replace(/\/$/, "") : "";

const api = axios.create({
  baseURL: normalizedBaseUrl, // Empty string = relative URLs (works when served from same origin)
});

export default api;
