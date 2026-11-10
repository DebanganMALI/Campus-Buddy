import { connectDb, disconnectDb } from "@scc/db";
import { createApp } from "./app.js";
import { env, isProd } from "./config/env.js";
import { logger } from "./lib/logger.js";

async function main(): Promise<void> {
  await connectDb(env.MONGO_URI, { appName: "scc-api", autoIndex: !isProd });
  const app = createApp();

  const server = app.listen(env.PORT, () => {
    logger.info(`API listening on http://localhost:${env.PORT}`);
  });

  const shutdown = (signal: string): void => {
    logger.info(`${signal} received, shutting down`);
    server.close(() => {
      void disconnectDb().finally(() => process.exit(0));
    });
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((err: unknown) => {
  logger.error({ err }, "failed to start");
  process.exit(1);
});
