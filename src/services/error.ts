import {Request, Response} from "express";

export const error = async (req: Request, res: Response) => {
    throw new Error('Error on endpoint ->' + req.path);
}