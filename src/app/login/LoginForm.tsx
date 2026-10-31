"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(
    searchParams.get("error") === "auth_failed"
      ? "لینک ورود منقضی شده یا نامعتبره. دوباره امتحان کن."
      : null,
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
      },
    });
    if (error) setError(error.message);
    else setSent(true);
  }

  return (
    <div className="w-full max-w-sm space-y-6" dir="rtl">
      <h1 className="text-2xl font-bold text-center">ورود به RCA Agent</h1>
      {sent ? (
        <p className="text-center text-sm text-neutral-600">
          یک لینک ورود به {email} فرستاده شد. ایمیلت رو چک کن.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            required
            placeholder="ایمیلت رو وارد کن"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border px-4 py-2 text-right"
            dir="ltr"
          />
          <button
            type="submit"
            className="w-full rounded-lg bg-black py-2 text-white"
          >
            ارسال لینک ورود
          </button>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </form>
      )}
    </div>
  );
}
