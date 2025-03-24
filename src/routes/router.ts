import {Router} from "express";
import {asyncHandler} from "../utils/async-wrapper";
import {hello} from "../services/hello";
import {error} from "../services/error";
import {scrape} from "../services/scrape";
import {search} from "../services/search";

export const router = Router();

router.get('/hello', asyncHandler(hello));
router.get('/error', asyncHandler(error));
router.get('/scrape', asyncHandler(scrape));
router.get('/search', asyncHandler(search));