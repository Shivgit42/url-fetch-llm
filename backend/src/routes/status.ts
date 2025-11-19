import express from "express";
import { handleStatus } from "../app/presenters/statusPresenter";

const router = express.Router();

router.get("/status", handleStatus);

export default router;



