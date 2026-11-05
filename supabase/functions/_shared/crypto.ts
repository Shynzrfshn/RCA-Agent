// AES-GCM encryption for stored OAuth tokens, and HMAC-signed tokens for
// links/actions that arrive without a user session (OAuth state, push buttons).

const enc = new TextEncoder();
const dec = new TextDecoder();

function b64urlEncode(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(str: string): Uint8Array<ArrayBuffer> {
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

let aesKey: Promise<CryptoKey> | undefined;
function getAesKey(): Promise<CryptoKey> {
  aesKey ??= (() => {
    const raw = Deno.env.get("ENCRYPTION_KEY");
    if (!raw) throw new Error("ENCRYPTION_KEY is not set");
    const bytes = b64urlDecode(raw);
    if (bytes.length !== 32) throw new Error("ENCRYPTION_KEY must be 32 bytes (base64url)");
    return crypto.subtle.importKey("raw", bytes, "AES-GCM", false, ["encrypt", "decrypt"]);
  })();
  return aesKey;
}

export async function encrypt(plain: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await getAesKey(), enc.encode(plain)),
  );
  return `${b64urlEncode(iv)}.${b64urlEncode(ct)}`;
}

export async function decrypt(token: string): Promise<string> {
  const [iv, ct] = token.split(".");
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: b64urlDecode(iv) },
    await getAesKey(),
    b64urlDecode(ct),
  );
  return dec.decode(pt);
}

let hmacKey: Promise<CryptoKey> | undefined;
function getHmacKey(): Promise<CryptoKey> {
  hmacKey ??= (() => {
    const raw = Deno.env.get("SIGNING_SECRET");
    if (!raw) throw new Error("SIGNING_SECRET is not set");
    return crypto.subtle.importKey(
      "raw",
      enc.encode(raw),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign", "verify"],
    );
  })();
  return hmacKey;
}

/** Signs a JSON payload. `ttlSeconds` sets an expiry. */
export async function sign(payload: Record<string, unknown>, ttlSeconds: number): Promise<string> {
  const body = b64urlEncode(
    enc.encode(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + ttlSeconds })),
  );
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", await getHmacKey(), enc.encode(body)));
  return `${body}.${b64urlEncode(sig)}`;
}

/** Returns the payload if the signature is valid and unexpired, else null. */
export async function verify<T = Record<string, unknown>>(token: string): Promise<T | null> {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const ok = await crypto.subtle.verify(
    "HMAC",
    await getHmacKey(),
    b64urlDecode(sig),
    enc.encode(body),
  );
  if (!ok) return null;
  const payload = JSON.parse(dec.decode(b64urlDecode(body)));
  if (typeof payload.exp !== "number" || payload.exp < Date.now() / 1000) return null;
  return payload as T;
}
