import type { RequestHandler } from "express";
import { randomToken } from "../lib/crypto.js";

const VALID_ID = /^[A-Za-z0-9_-]{8,64}$/;

// Reuse the proxy's request id when well-formed so logs line up end to end
export const requestId: RequestHandler = (req, res, next) => {
  const incoming = req.get("x-request-id");
  req.id = incoming && VALID_ID.test(incoming) ? incoming : `req_${randomToken(12)}`;
  res.setHeader("X-Request-Id", req.id);
  next();
};
