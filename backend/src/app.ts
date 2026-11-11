import path from "node:path";
import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import { pinoHttp } from "pino-http";
import { env } from "./config/env.js";
import { logger } from "./lib/logger.js";
import { errorHandler, notFound } from "./middleware/error-handler.js";
import { requestId } from "./middleware/request-id.js";
import { originGuard, rejectDangerousKeys, securityHeaders } from "./middleware/security.js";
import { verifyCsrf } from "./middleware/csrf.js";
import { rateLimit } from "./lib/rate-limit.js";
import { authRouter } from "./routes/auth.js";
import { announcementsRouter } from "./routes/announcements.js";
import { eventsRouter } from "./routes/events.js";
import { resourcesRouter } from "./routes/resources.js";
import { openingsRouter } from "./routes/openings.js";
import { profileRouter } from "./routes/profile.js";
import { searchRouter } from "./routes/search.js";
import { bookmarksRouter } from "./routes/bookmarks.js";
import { adminRouter } from "./routes/admin.js";

// Builds the Express app. Kept separate from server.ts so tests can import the
// app without opening a port.
export function createApp(): Express {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", env.TRUST_PROXY);

  const clientDir = env.CLIENT_DIR;

  // Order matters: request id first so every later log line carries it.
  app.use(requestId);
  // At debug level only, record the client IP Express resolved after TRUST_PROXY,
  // so the proxy hop count can be verified on a new host. Off at info level.
  const logClientIp = env.LOG_LEVEL === "debug" || env.LOG_LEVEL === "trace";
  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => (req as { id?: string }).id ?? "unknown",
      ...(logClientIp ? { customProps: (req) => ({ clientIp: (req as { ip?: string }).ip }) } : {}),
    }),
  );
  app.use(securityHeaders);

  // Same-origin SPA: serve static assets before the API middleware so they are
  // not rate-limited, origin-guarded or CSRF-checked. Missing files fall through
  // to the API; unmatched client routes get index.html below.
  if (clientDir) app.use(express.static(clientDir, { index: false, maxAge: "1h" }));
  app.use(express.json({ limit: "100kb" }));
  app.use(cookieParser());
  app.use(rateLimit("global")); // coarse per-IP ceiling across the whole API
  app.use(originGuard); // reject cross-origin unsafe requests
  app.use(rejectDangerousKeys); // block NoSQL-operator / prototype-pollution keys
  app.use(verifyCsrf); // double-submit CSRF check on unsafe methods

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", uptime: Math.round(process.uptime()) });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/announcements", announcementsRouter);
  app.use("/api/events", eventsRouter);
  app.use("/api/resources", resourcesRouter);
  app.use("/api/openings", openingsRouter);
  app.use("/api/profile", profileRouter);
  app.use("/api/search", searchRouter);
  app.use("/api/bookmarks", bookmarksRouter);
  app.use("/api/admin", adminRouter);

  // SPA fallback: any non-API GET returns index.html so client-side routing
  // works on refresh/deep links. /api/* still falls through to notFound (JSON).
  if (clientDir) {
    app.get(/(.*)/, (req, res, next) => {
      if (req.path.startsWith("/api/")) return next();
      res.sendFile(path.join(clientDir, "index.html"));
    });
  }

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
