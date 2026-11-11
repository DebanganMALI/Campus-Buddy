import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";

// Helper to get the secret key (requires a 32-byte key)
function getKey(): Buffer {
  const key = process.env.FIELD_ENCRYPTION_KEY;
  if (!key) {
    // Never fall back in production: this key is visible in the repo, so data
    // "encrypted" with it would be readable by anyone with the source.
    if (process.env.NODE_ENV === "production") {
      throw new Error("FIELD_ENCRYPTION_KEY is required in production");
    }
    // Development/test fallback only
    return Buffer.alloc(32, "dev-secret-key-do-not-use-in-prd");
  }
  const buf = Buffer.from(key, "base64");
  if (buf.length !== 32) throw new Error("FIELD_ENCRYPTION_KEY must be 32 bytes, base64-encoded");
  return buf;
}

export function encryptField(text: string): string {
  if (!text) return text;
  
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  
  let encrypted = cipher.update(text, "utf8");
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  const tag = cipher.getAuthTag();
  
  // Format: v1:<iv>:<tag>:<ciphertext> encoded as base64url
  return `v1:${iv.toString("base64url")}:${tag.toString("base64url")}:${encrypted.toString("base64url")}`;
}

export function decryptField(encryptedText: string): string {
  if (!encryptedText || !encryptedText.startsWith("v1:")) return encryptedText;
  
  const parts = encryptedText.split(":");
  if (parts.length !== 4) throw new Error("Invalid encrypted field format");
  
  const [, ivStr, tagStr, cipherStr] = parts as [string, string, string, string];
  
  const iv = Buffer.from(ivStr, "base64url");
  const tag = Buffer.from(tagStr, "base64url");
  const ciphertext = Buffer.from(cipherStr, "base64url");
  
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(tag);
  
  let decrypted = decipher.update(ciphertext);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  
  return decrypted.toString("utf8");
}
