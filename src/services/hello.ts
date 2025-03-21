import {Request, Response} from "express";

export const hello = async (req: Request, res: Response) => {
    res.status(200).json({
        success: true,
        message: 'Hello !'
    });
}