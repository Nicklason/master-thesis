import Joi from "joi";
import { Request, Response, NextFunction } from "express";

export function validateRequest(schema: Joi.Schema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.validate(req.body);

    if (result.error) {
      return res.status(400).json({
        errors: result.error.message,
      });
    }

    next();
  };
}

export const dataSchema = Joi.object({
  topic: Joi.string().required(),
  data: Joi.string().base64().required(),
  destinations: Joi.array().items(Joi.string()).optional(),
});

export interface DataBody {
  topic: string;
  data: string;
  destinations?: number[];
}
