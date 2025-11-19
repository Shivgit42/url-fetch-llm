import { Request, Response } from "express";
import { getSystemStatus } from "../services/statusService";

export async function handleStatus(req: Request, res: Response) {
  try {
    const status = await getSystemStatus();
    res.json(status);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to get status" });
  }
}

