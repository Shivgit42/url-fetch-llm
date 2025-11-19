import axios from "axios";

const rawBaseUrl = import.meta.env.VITE_API_BASE_URL;
const normalizedBaseUrl = rawBaseUrl ? rawBaseUrl.replace(/\/$/, "") : "";

const api = axios.create({
  baseURL: normalizedBaseUrl,
});

export default api;
