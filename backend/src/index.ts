import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { initDatabase } from "./config/database";
import { initPinecone } from "./config/pinecone";
import uploadRouter from "./routes/upload";
import searchRouter from "./routes/search";
import statusRouter from "./routes/status";
import typesRouter from "./routes/types";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", uploadRouter);
app.use("/api", searchRouter);
app.use("/api", statusRouter);
app.use("/api", typesRouter);

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

async function startServer() {
  try {
    await initDatabase();
    await initPinecone();

    app.listen(PORT);
  } catch (error) {
    process.exit(1);
  }
}

startServer();
