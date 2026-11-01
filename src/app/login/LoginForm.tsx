"use client";

import { useSearchParams } from "next/navigation";
import { useId, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginForm() {
  const searchParams = useSearchParams();
  const emailId = useId();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(
    searchParams.get("error") === "auth_failed"
      ? "لینک ورود منقضی شده یا نامعتبره. دوباره امتحان کن."
      : null,
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
      },
    });
    setLoading(false);
    if (error) setError(error.message);
    else setSent(true);
  }

  return (
    <div className="w-full max-w-sm space-y-6 rounded-2xl border border-border bg-surface p-8 shadow-sm">
      <div className="space-y-1 text-center">
        <h1 className="text-xl font-bold">ورود به RCA Agent</h1>
        <p className="text-sm text-muted">با ایمیلت، بدون پسورد</p>
      </div>

      {sent ? (
        <p
          role="status"
          className="rounded-lg bg-background p-4 text-center text-sm text-muted"
        >
          یک لینک ورود به <span className="font-medium">{email}</span> فرستاده
          شد. ایمیلت رو چک کن.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <label htmlFor={emailId} className="block text-sm font-medium">
              ایمیل
            </label>
            <input
              id={emailId}
              type="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-right outline-none focus-visible:ring-2 focus-visible:ring-ring"
              dir="ltr"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-accent py-2.5 font-medium text-accent-foreground transition hover:opacity-90 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {loading ? "در حال ارسال..." : "ارسال لینک ورود"}
          </button>
          {error && (
            <p role="alert" className="rounded-lg bg-danger-bg p-3 text-sm text-danger">
              {error}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
