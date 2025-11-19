import { Request, Response } from "express";
import { getAvailableTypes, getRecentUrls } from "../services/typesService";

export async function handleTypes(req: Request, res: Response) {
  try {
    const result = await getAvailableTypes();
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to fetch types" });
  }
}

export async function handleRecentUrls(req: Request, res: Response) {
  try {
    const result = await getRecentUrls();
    res.json(result);
  } catch (error: any) {
    res
      .status(500)
      .json({ error: error.message || "Failed to fetch recent URLs" });
  }
}

