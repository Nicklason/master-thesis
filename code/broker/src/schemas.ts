import Joi from "joi";
import { Request, Response, NextFunction } from "express";

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export function validateRequest(
  schema: Joi.Schema,
  location: "body" | "params" | "query",
) {
  return (req: Request, _: Response, next: NextFunction) => {
    const result = schema.validate(req[location]);

    if (result.error) {
      return next(new ValidationError(result.error.message));
    }

    next();
  };
}

export const dataSchema = Joi.object({
  topic: Joi.string().required(),
  data: Joi.string().base64().required(),
  destinations: Joi.array().items(Joi.number()).optional(),
});

export interface DataBody {
  topic: string;
  data: string;
  destinations?: number[];
}

export const peerSchema = Joi.object({
  host: Joi.string().hostname().required(),
  port: Joi.number().port().required(),
});

export interface PeerBody {
  host: string;
  port: number;
}

export const idSchema = Joi.object({
  id: Joi.number().required(),
});
