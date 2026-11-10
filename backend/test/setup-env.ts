// Runs before any test module, so the required environment is present when
// src/config/env.ts validates it. Tests connect to an in-memory MongoDB, so the
// MONGO_URI below is only a placeholder that satisfies the schema; the real URI
// is passed to connectDb() in the test. Rate limiting is disabled under test.
process.env.NODE_ENV = "test";
process.env.APP_ORIGIN = "http://localhost:5173";
process.env.MONGO_URI = "mongodb://127.0.0.1:27017/scc-test";
process.env.REDIS_URL = "redis://127.0.0.1:6379";
process.env.CSRF_SECRET = "0123456789abcdef0123456789abcdef";
process.env.PASSWORD_PEPPER = "abcdef0123456789abcdef0123456789";
process.env.MFA_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
process.env.JWT_PRIVATE_KEY = "test-private-key";
process.env.JWT_KEY_ID = "test";
process.env.HIBP_ENABLED = "false";
process.env.LOG_LEVEL = "silent";
