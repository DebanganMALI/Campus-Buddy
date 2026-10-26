import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";

// Helper to get the secret key (requires a 32-byte key)
function getKey(): Buffer {
  const key = process.env.FIELD_ENCRYPTION_KEY;
  if (!key) {
    // Development fallback if no environment variable is set
    return Buffer.alloc(32, "dev-secret-key-do-not-use-in-prd"); 
  }
  return Buffer.from(key, "base64");
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
  
  const [, ivStr, tagStr, cipherStr] = parts;
  
  const iv = Buffer.from(ivStr, "base64url");
  const tag = Buffer.from(tagStr, "base64url");
  const ciphertext = Buffer.from(cipherStr, "base64url");
  
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(tag);
  
  let decrypted = decipher.update(ciphertext);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  
  return decrypted.toString("utf8");
}
