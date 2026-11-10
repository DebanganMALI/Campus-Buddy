import mongoose from "mongoose";

// Apply global Mongoose settings required by the package spec
mongoose.set("strictQuery", true);
mongoose.set("sanitizeFilter", true);

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
