import {NextFunction, Request, Response} from "express";


export const errorWrapper = (error: Error, req: Request, res: Response, next: NextFunction) => {
    res.status(500).json({
        success: false,
        message: error.message
    });
}