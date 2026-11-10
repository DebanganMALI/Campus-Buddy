import { randomBytes } from "node:crypto";

// Prints a block of secrets to paste into backend/.env.
// Run with: npm run gen:secrets -w @scc/backend
const hex = (n: number): string => randomBytes(n).toString("hex");
const b64 = (n: number): string => randomBytes(n).toString("base64");

const lines = [
  `CSRF_SECRET=${hex(32)}`,
  `PASSWORD_PEPPER=${hex(32)}`,
  `MFA_ENCRYPTION_KEY=${b64(32)}`,
  `JWT_KEY_ID=dev-${hex(4)}`,
  // Placeholder: JWT signing is not used by the Option A session auth, but the
  // config still requires the field to be present.
  `JWT_PRIVATE_KEY=${b64(48)}`,
];

console.log(lines.join("\n"));
