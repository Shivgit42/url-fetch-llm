import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { initDatabase, pool } from "./config/database";
import { initPinecone } from "./config/pinecone";
import uploadRouter from "./routes/upload";
import searchRouter from "./routes/search";
import statusRouter from "./routes/status";
import typesRouter from "./routes/types";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;
const log = (...args: unknown[]) =>
  console.info(new Date().toISOString(), "-", ...args);

app.use(
  cors({
    origin: "http://localhost:3050",
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", uploadRouter);
app.use("/api", searchRouter);
app.use("/api", statusRouter);
app.use("/api", typesRouter);

app.get("/", (req, res) => {
  res.json({
    service: "url-fetch-llm-backend",
    host: req.hostname,
    health: "/health",
  });
});

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

async function startServer() {
  const bootStarted = Date.now();
  try {
    log("Initializing services: database, pinecone");
    await Promise.all([initDatabase(), initPinecone()]);
    log("Services initialized successfully");

    app.listen(PORT, () => {
      const duration = Date.now() - bootStarted;
      log(`Server listening on port ${PORT} (ready in ${duration}ms)`);
    });
  } catch (error) {
    log("Failed to start server", error);
    process.exit(1);
  }
}

void startServer();
