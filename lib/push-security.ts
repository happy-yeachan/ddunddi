import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

function secret() {
  const value = process.env.GATE_PASSWORD;
  if (!value) throw new Error("Gate not configured");
  return value;
}
export function sessionToken(expiry = Date.now() + 180 * 86400000) {
  const data = String(expiry);
  return `${data}.${createHmac("sha256", secret()).update(`push-session:${data}`).digest("hex")}`;
}
export function validSession(token: string) {
  const expiry = Number(token.split(".")[0]);
  if (!Number.isFinite(expiry) || expiry < Date.now()) return false;
  const expected = Buffer.from(sessionToken(expiry));
  const given = Buffer.from(token);
  return expected.length === given.length && timingSafeEqual(expected, given);
}
function key() { return createHash("sha256").update(`ddunddi-push-encryption:${secret()}`).digest(); }
export function encrypt(value: unknown) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64url");
}
export function decrypt<T>(value: string): T {
  const bytes = Buffer.from(value, "base64url");
  const decipher = createDecipheriv("aes-256-gcm", key(), bytes.subarray(0, 12));
  decipher.setAuthTag(bytes.subarray(12, 28));
  return JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString("utf8"));
}
export function endpointId(endpoint: string) { return createHash("sha256").update(endpoint).digest("hex"); }
export function validEndpoint(endpoint: unknown): endpoint is string {
  if (typeof endpoint !== "string" || endpoint.length > 4096) return false;
  try {
    const u = new URL(endpoint);
    return u.protocol === "https:" && !u.username && !u.password && !u.port && (
      u.hostname === "fcm.googleapis.com" || u.hostname === "updates.push.services.mozilla.com" ||
      u.hostname === "web.push.apple.com" || u.hostname.endsWith(".push.apple.com") ||
      u.hostname.endsWith(".notify.windows.com")
    );
  } catch { return false; }
}
