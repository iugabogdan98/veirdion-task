import {NextFunction, Request, Response} from "express";

interface AsyncReqHandler {
    (req: Request, res: Response, next: NextFunction): Promise<void | Response>;
}

export const asyncHandler = (handler: AsyncReqHandler) => (req: Request, res: Response, next: NextFunction) => {
    handler(req, res, next).catch(next);
}