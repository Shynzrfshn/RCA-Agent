/** Sends one private morning brief. Credentials never reach the browser. */
export async function sendMorningEmail(to: string, content: string, day: string): Promise<string> {
  const key = Deno.env.get("BREVO_API_KEY");
  const from = Deno.env.get("MORNING_EMAIL_FROM");
  if (!key || !from) throw new Error("morning_email_not_configured");
  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": key, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      sender: { email: from, name: "RCA Agent" },
      to: [{ email: to }],
      subject: `برنامهٔ امروز شما | ${day}`,
      textContent: `برنامهٔ امروز شما\n\n${content}\n\nتنظیم یا توقف ایمیل صبحگاهی: https://shynzrfshn.github.io/RCA-Agent/settings/`,
    }),
  });
  if (!response.ok) throw new Error(`brevo_http_${response.status}`);
  const result = await response.json() as { messageId?: string };
  return result.messageId ?? "accepted";
}

