import {
  createClient,
  type SupabaseClient,
  type User,
} from "npm:@supabase/supabase-js@2.118.0";
import { HttpError } from "./http.ts";

const url = () => Deno.env.get("SUPABASE_URL")!;

/** Service-role client: bypasses RLS. Always filter by user_id explicitly. */
export function adminClient(): SupabaseClient {
  return createClient(url(), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Client that acts as the signed-in user, so RLS and auth.uid() apply. */
export function userClient(jwt: string): SupabaseClient {
  return createClient(url(), Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function requireUser(
  req: Request,
): Promise<{ user: User; jwt: string; db: SupabaseClient }> {
  const jwt = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!jwt) throw new HttpError(401, "missing_token");
  const { data, error } = await adminClient().auth.getUser(jwt);
  if (error || !data.user) throw new HttpError(401, "invalid_token");
  return { user: data.user, jwt, db: userClient(jwt) };
}
