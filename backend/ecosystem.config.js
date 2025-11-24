// Load environment variables from .env file
const path = require("path");
const fs = require("fs");
const envPath = path.join(__dirname, ".env");

let envVars = { ...process.env }; // Start with system env

if (fs.existsSync(envPath)) {
  const result = require("dotenv").config({ path: envPath });
  if (result.error) {
    console.error("[PM2] Error loading .env file:", result.error);
  } else {
    console.log("[PM2] Loaded .env file from:", envPath);
    // Merge .env vars into envVars (dotenv.config() modifies process.env)
    envVars = { ...process.env };
  }
  
  // Log which keys are detected (without showing values)
  const requiredKeys = ["PINECONE_API_KEY", "OPENROUTER_API_KEY", "OPENAI_API_KEY", "DB_HOST", "REDIS_HOST", "EMBEDDING_MODEL"];
  console.log("[PM2] ===== ENVIRONMENT VARIABLES CHECK =====", );
  requiredKeys.forEach(key => {
    const value = envVars[key];
    const isSet = value ? "SET" : "NOT SET";
    const length = value ? value.length : 0;
    const preview = value ? value.substring(0, 10) + "..." : "";
    console.log(`[PM2] ${key}: ${isSet} ${isSet === "SET" ? `(${length} chars, starts: ${preview})` : ""}`);
  });
  console.log("[PM2] ======================================");
} else {
  console.warn("[PM2] Warning: .env file not found at", envPath);
  console.warn("[PM2] Make sure your .env file is in the backend/ directory");
  console.warn("[PM2] Current working directory:", process.cwd());
  console.warn("[PM2] __dirname:", __dirname);
}

// Get all environment variables (includes .env + system env)
// PM2 will pass these to the child processes
// Make sure we're using the merged envVars

module.exports = {
  apps: [
    {
      name: "url-fetch-llm-api",
      script: "./dist/index.js",
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        PORT: envVars.PORT || 5001,
        ...envVars, // Spread all .env variables
      },
      env_development: {
        NODE_ENV: "development",
        PORT: envVars.PORT || 5001,
        ...envVars, // Spread all .env variables
      },
      error_file: "./logs/api-error.log",
      out_file: "./logs/api-out.log",
      log_file: "./logs/api-combined.log",
      time: true,
      merge_logs: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: "10s",
      max_memory_restart: "1G",
      watch: false,
      ignore_watch: ["node_modules", "logs", "dist"],
    },
    {
      name: "url-fetch-llm-worker",
      script: "./dist/worker.js",
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        ...envVars, // Spread all .env variables
      },
      env_development: {
        NODE_ENV: "development",
        ...envVars, // Spread all .env variables
      },
      error_file: "./logs/worker-error.log",
      out_file: "./logs/worker-out.log",
      log_file: "./logs/worker-combined.log",
      time: true,
      merge_logs: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: "10s",
      max_memory_restart: "1G",
      watch: false,
      ignore_watch: ["node_modules", "logs", "dist"],
    },
  ],
};

