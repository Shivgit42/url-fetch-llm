import { Request, Response } from "express";
import { processUpload } from "../services/uploadService";

export async function handleUpload(req: Request, res: Response) {
  try {
    const { csvContent, fileName } = req.body;
    const result = await processUpload({ csvContent, fileName });
    res.json({ message: "ok", ...result });
  } catch (error: any) {
    res
      .status(400)
      .json({ error: error.message || "Failed to process upload" });
  }
}

