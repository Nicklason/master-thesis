import winston from "winston";

export class Logger {
  private readonly logger: winston.Logger;

  constructor(name: string) {
    this.logger = winston.createLogger({
      level: "debug",
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.label({ label: name, message: true }),
        winston.format.simple(),
      ),
      transports: [new winston.transports.Console()],
      defaultMeta: {},
    });
  }

  info(message: string): void {
    this.logger.info(message);
  }

  debug(message: string): void {
    this.logger.debug(message);
  }

  warn(message: string): void {
    this.logger.warn(message);
  }

  error(message: string, err: Error): void {
    this.logger.error(message, err);
  }

  setMeta(key: string, value: any): void {
    this.logger.defaultMeta[key] = value;
  }

  removeMeta(key: string): void {
    delete this.logger.defaultMeta[key];
  }
}
