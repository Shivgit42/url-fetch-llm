import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { initDatabase, pool } from "./config/database";
import { initPinecone } from "./config/pinecone";
import uploadRouter from "./routes/upload";
import searchRouter from "./routes/search";
import statusRouter from "./routes/status";
import typesRouter from "./routes/types";

const app = express();
const PORT = 5001; // Using default port
const log = (...args: unknown[]) =>
  console.info(new Date().toISOString(), "-", ...args);

// CORS configuration - allow same origin when serving frontend
app.use(
  cors({
    origin: "http://localhost:3050",
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API routes (must come before static files)
app.use("/api", uploadRouter);
app.use("/api", searchRouter);
app.use("/api", statusRouter);
app.use("/api", typesRouter);

// Health check endpoint
app.get("/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({
      status: "ok",
      host: req.hostname,
      database: "connected",
    });
  } catch {
    res.status(503).json({
      status: "degraded",
      host: req.hostname,
      database: "unreachable",
    });
  }
});

// Serve frontend static files
// Resolve path: from backend/dist/ (compiled) go up to project root, then into frontend/dist
const projectRoot = path.resolve(__dirname, "../..");
const frontendDistPath = path.join(projectRoot, "frontend", "dist");
const frontendExists = fs.existsSync(frontendDistPath);

// Debug logging
log(`Looking for frontend at: ${frontendDistPath}`);
log(`Frontend exists: ${frontendExists}`);
if (!frontendExists) {
  log(`Current working directory: ${process.cwd()}`);
  log(`__dirname: ${__dirname}`);
}

if (frontendExists) {
  // Serve static files from frontend dist
  app.use(express.static(frontendDistPath));

  // SPA fallback - serve index.html for all non-API routes
  app.get("*", (req, res) => {
    // Don't serve index.html for API routes
    if (req.path.startsWith("/api")) {
      return res.status(404).json({ error: "Not found" });
    }
    res.sendFile(path.join(frontendDistPath, "index.html"));
  });

  log(`Frontend static files enabled from: ${frontendDistPath}`);
} else {
  log(
    `Frontend dist not found at ${frontendDistPath}. Run 'npm run build' in frontend directory.`
  );

  // Fallback root endpoint when frontend is not built
  app.get("/", (req, res) => {
    res.json({
      service: "url-fetch-llm-backend",
      host: req.hostname,
      health: "/health",
      frontend:
        "Frontend not built. Run 'npm run build' in frontend directory.",
    });
  });
}

async function startServer() {
  const bootStarted = Date.now();
  try {
    log("Initializing services: database, pinecone");

    // Initialize database (required)
    await initDatabase();
    log("Database initialized successfully");

    // Initialize Pinecone (optional - won't crash if it fails)
    const pineconeInitialized = await initPinecone();
    if (pineconeInitialized) {
      log("Pinecone initialized successfully");
    }
    // If Pinecone failed, initPinecone already logged a brief message

    app.listen(PORT, () => {
      const duration = Date.now() - bootStarted;
      log(`Server listening on port ${PORT} (ready in ${duration}ms)`);
      if (pineconeInitialized) {
        log("Vector search: Enabled");
      } else {
        log("Vector search: Disabled (optional feature)");
      }
    });
  } catch (error: any) {
    log("Failed to start server", error.message || error);
    process.exit(1);
  }
}

void startServer();
