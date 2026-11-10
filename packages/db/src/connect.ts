import mongoose from "mongoose";

// Strip query keys not in the schema. We intentionally do NOT enable the global
// `sanitizeFilter`: it rewrites every `{ $op: ... }` our own code builds (e.g.
// `{ publishAt: { $lte: now } }`, `{ _id: { $in: ids } }`) into a literal `$eq`,
// which then fails to cast and 500s. NoSQL operator injection is instead closed
// at the boundary — every req.query/req.body is Zod-parsed into scalars before it
// reaches a query, so an attacker cannot smuggle an operator object through. For
// the rare filter built from a value we don't fully control, wrap that one
// operator expression in `trusted()` (re-exported below) rather than flipping the
// global flag back on.
mongoose.set("strictQuery", true);

interface ConnectOptions {
  appName?: string;
  autoIndex?: boolean;
  maxPoolSize?: number;
}

export async function connectDb(uri: string, opts: ConnectOptions = {}) {
  console.log("Attempting database connection...");
  
  await mongoose.connect(uri, {
    appName: opts.appName || "scc-api",
    autoIndex: opts.autoIndex ?? false,
    maxPoolSize: opts.maxPoolSize || 50,
    minPoolSize: 5,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    retryWrites: true,
    w: "majority",
    readPreference: "primary",
  });

  console.log("Database connected successfully.");
}

export async function disconnectDb() {
  await mongoose.disconnect();
  console.log("Database disconnected.");
}

export function pingDb(): boolean {
  // readyState 1 means strictly connected
  return mongoose.connection.readyState === 1;
}

export async function syncIndexes() {
  const models = mongoose.modelNames();
  for (const modelName of models) {
    await mongoose.model(modelName).syncIndexes();
  }
}

// Re-export Mongoose's trusted function as requested
export const trusted = mongoose.trusted;
