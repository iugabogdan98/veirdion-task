import {Router} from "express";
import {asyncHandler} from "../async-wrapper";
import {hello} from "../services/hello";
import {error} from "../services/error";

export const router = Router();

router.get('/hello', asyncHandler(hello));
router.get('/error', asyncHandler(error));