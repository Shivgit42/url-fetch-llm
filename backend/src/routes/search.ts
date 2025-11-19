import express from "express";
import { handleSearch } from "../app/presenters/searchPresenter";

const router = express.Router();

router.post("/search", handleSearch);

export default router;

