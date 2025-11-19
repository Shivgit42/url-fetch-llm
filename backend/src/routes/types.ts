import express from "express";
import {
  handleRecentUrls,
  handleTypes,
} from "../app/presenters/typesPresenter";

const router = express.Router();

router.get("/types", handleTypes);
router.get("/recent-urls", handleRecentUrls);

export default router;
