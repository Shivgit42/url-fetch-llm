import express, { Request, Response } from 'express';
import { handleUpload } from "../app/presenters/uploadPresenter";

const router = express.Router();

router.post('/upload', async (req: Request, res: Response) => {
  return handleUpload(req, res);
});

export default router;

