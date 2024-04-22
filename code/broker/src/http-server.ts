import { Broker } from "./broker";
import express, { NextFunction, Request, Response } from "express";
import { Server } from "node:http";
import { MessageFactory } from "./messages/factory";
import {
  DataBody,
  PeerBody,
  ValidationError,
  dataSchema,
  idSchema,
  peerSchema,
  validateRequest,
} from "./schemas";
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
      validateRequest(dataSchema, "body"),
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

    this.app.get(
      "/peers",
      asyncHandler(async (_, res) => {
        const peers = broker.getPeers();
        res.json(peers);
      }),
    );

    this.app.post<unknown, unknown, PeerBody>(
      "/peers",
      validateRequest(peerSchema, "body"),
      asyncHandler(async (req, res) => {
        await broker.addPeer(req.body.host, req.body.port);
        res.json({ success: true });
      }),
    );

    this.app.delete(
      "/peers/:id",
      validateRequest(idSchema, "params"),
      asyncHandler(async (req, res) => {
        await broker.removePeerById(parseInt(req.params.id, 10));
        res.json({ success: true });
      }),
    );

    this.app.delete(
      "/peers",
      validateRequest(peerSchema, "body"),
      asyncHandler(async (req, res) => {
        await broker.removePeerByHost(req.body.host, req.body.port);
        res.json({ success: true });
      }),
    );

    this.app.get('/topology', asyncHandler(async (_, res) => {
      const topology = broker.getTopology();
      res.json(topology.toJSON());      
    }));

    this.app.use((err: Error, _: Request, res: Response, __: NextFunction) => {
      if (err instanceof SyntaxError) {
        return res.status(400).json({
          error: "Invalid JSON payload",
        });
      } else if (err instanceof ValidationError) {
        return res.status(400).json({
          error: err.message,
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
