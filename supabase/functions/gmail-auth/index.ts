// POST (signed-in user)   -> { url } to start Google OAuth
// GET  ?code=&state=      -> OAuth callback from Google; stores the refresh
//                            token encrypted and redirects back to the app.
import { HttpError, json, serve } from "../_shared/http.ts";
import { adminClient, requireUser } from "../_shared/supabase.ts";
import { encrypt, sign, verify } from "../_shared/crypto.ts";
import { authUrl, exchangeCode, getProfile } from "../_shared/gmail.ts";

const appUrl = () => (Deno.env.get("APP_URL") ?? "http://localhost:3000").replace(/\/$/, "");

serve(async (req) => {
  if (req.method === "POST") {
    const { user } = await requireUser(req);
    const state = await sign({ uid: user.id, purpose: "gmail" }, 600);
    return json({ url: authUrl(state) });
  }

  if (req.method !== "GET") throw new HttpError(405, "method_not_allowed");
  const params = new URL(req.url).searchParams;
  const back = (status: string) =>
    Response.redirect(`${appUrl()}/settings/?gmail=${status}`, 302);

  if (params.get("error")) return back("denied");
  const state = await verify<{ uid: string; purpose: string }>(params.get("state") ?? "");
  const code = params.get("code");
  if (!state || state.purpose !== "gmail" || !code) return back("invalid");

  try {
    const tokens = await exchangeCode(code);
    if (!tokens.refresh_token) return back("no_refresh_token");
    const { emailAddress } = await getProfile(tokens.access_token);
    const admin = adminClient();
    const { data: account, error } = await admin
      .from("email_accounts")
      .upsert(
        { user_id: state.uid, provider: "gmail", email: emailAddress, last_error: null },
        { onConflict: "user_id,provider,email" },
      )
      .select("id")
      .single();
    if (error) throw error;
    await admin.from("email_credentials").upsert({
      account_id: account.id,
      refresh_token_enc: await encrypt(tokens.refresh_token),
      updated_at: new Date().toISOString(),
    });
    return back("connected");
  } catch (err) {
    console.error("gmail oauth failed", err);
    return back("error");
  }
});
