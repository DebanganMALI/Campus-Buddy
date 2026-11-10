import { hash, verify } from "@node-rs/argon2";
import { env } from "../config/env.js";

// The pepper is a server-side secret mixed into every hash. Unlike the per-user
// salt (which argon2 stores inside the hash string), the pepper never touches the
// database, so a leaked database alone cannot be brute-forced offline.
const pepper = Buffer.from(env.PASSWORD_PEPPER, "utf8");

export const hashPassword = (plain: string): Promise<string> => hash(plain, { secret: pepper });

export const verifyPassword = (hashed: string, plain: string): Promise<boolean> =>
  verify(hashed, plain, { secret: pepper });
