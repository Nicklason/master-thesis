import { Broker } from "./broker";
import express, { NextFunction, Request, Response } from "express";
import { Server } from "node:http";
import { MessageFactory } from "./messages/factory";
import { DataBody, dataSchema, validateRequest } from "./schemas";
import asyncHandler from "express-async-handler";
import { Logger } from "./logger";

export class HTTPServer {
  private readonly logger = new Logger(HTTPServer.name);
  private readonly app = express();
  private server: Server | null = null;

  constructor(broker: Broker) {
    this.app.use(express.json());

    this.app.post<unknown, unknown, DataBody>(
      "/data",
      validateRequest(dataSchema),
      asyncHandler(async (req, res) => {
        const data = MessageFactory.data(
          req.body.topic,
          Buffer.from(req.body.data, "base64"),
        );

        if (req.body.destinations) {
          data.setDestinations(req.body.destinations);
        }

        await broker.publish(data.build());

        res.json({ success: true });
      }),
    );

    this.app.use((err: Error, _: Request, res: Response, __: NextFunction) => {
      if (err instanceof SyntaxError) {
        return res.status(400).json({
          error: "Invalid JSON payload",
        });
      }

      this.logger.error("Error occurred while handling request", err);
      res.status(500).json({
        error: "Internal server error",
      });
    });

    this.app.listen(3000, () => {
      console.log("Server is running on port 3000");
    });
  }

  start(port: number): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        return;
      }

      this.server = this.app.listen(port, () => {
        resolve();
      });
    });
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.server) {
        return resolve();
      }

      this.server.close(() => {
        this.server = null;
        resolve();
      });
    });
  }
}
