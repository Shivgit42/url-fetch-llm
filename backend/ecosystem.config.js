// Load environment variables from .env file
const path = require("path");
const fs = require("fs");
const envPath = path.join(__dirname, ".env");

if (fs.existsSync(envPath)) {
  require("dotenv").config({ path: envPath });
  console.log("[PM2] Loaded .env file");
} else {
  console.warn("[PM2] Warning: .env file not found at", envPath);
}

// Get all environment variables (includes .env + system env)
// PM2 will pass these to the child processes
const envVars = { ...process.env };

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

