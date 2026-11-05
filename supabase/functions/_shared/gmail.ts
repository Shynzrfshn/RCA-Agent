// Minimal Gmail REST client (read-only scope).
export const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "openid",
  "email",
].join(" ");

export const redirectUri = () => `${Deno.env.get("SUPABASE_URL")}/functions/v1/gmail-auth`;

function googleCreds() {
  const id = Deno.env.get("GOOGLE_CLIENT_ID");
  const secret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  if (!id || !secret) throw new Error("GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are not set");
  return { id, secret };
}

export function authUrl(state: string): string {
  const p = new URLSearchParams({
    client_id: googleCreds().id,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: GMAIL_SCOPES,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
}

async function tokenRequest(params: Record<string, string>) {
  const { id, secret } = googleCreds();
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: id, client_secret: secret, ...params }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`google token error: ${body.error ?? res.status}`);
  return body as { access_token: string; refresh_token?: string; expires_in: number };
}

export const exchangeCode = (code: string) =>
  tokenRequest({ code, grant_type: "authorization_code", redirect_uri: redirectUri() });

export const refreshAccess = (refreshToken: string) =>
  tokenRequest({ refresh_token: refreshToken, grant_type: "refresh_token" });

async function gmail<T>(accessToken: string, path: string): Promise<T> {
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`gmail ${path.split("?")[0]}: ${res.status}`);
  return res.json();
}

export const getProfile = (at: string) => gmail<{ emailAddress: string }>(at, "profile");

export async function listMessageIds(at: string, query: string, max = 25): Promise<string[]> {
  const r = await gmail<{ messages?: { id: string }[] }>(
    at,
    `messages?${new URLSearchParams({ q: query, maxResults: String(max) })}`,
  );
  return (r.messages ?? []).map((m) => m.id);
}

export type GmailMeta = {
  id: string;
  threadId: string;
  snippet: string;
  internalDate: string;
  labelIds?: string[];
  from: string;
  subject: string;
};

export async function getMessageMeta(at: string, id: string): Promise<GmailMeta> {
  const r = await gmail<{
    id: string;
    threadId: string;
    snippet: string;
    internalDate: string;
    labelIds?: string[];
    payload: { headers: { name: string; value: string }[] };
  }>(at, `messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject`);
  const h = (n: string) =>
    r.payload.headers.find((x) => x.name.toLowerCase() === n.toLowerCase())?.value ?? "";
  return {
    id: r.id,
    threadId: r.threadId,
    snippet: decodeEntities(r.snippet ?? ""),
    internalDate: r.internalDate,
    labelIds: r.labelIds,
    from: h("From"),
    subject: h("Subject"),
  };
}

function decodeEntities(s: string): string {
  return s
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}
