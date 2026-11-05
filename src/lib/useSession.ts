"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

/** Redirects to /login when signed out; returns the user once known. */
export function useRequireUser() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.replace("/login/");
        return;
      }
      setUser(session.user);
      if (window.location.search.includes("code=")) {
        window.history.replaceState(null, "", window.location.pathname);
      }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.replace("/login/");
      else setUser(session.user);
    });
    return () => sub.subscription.unsubscribe();
  }, [router]);

  return user;
}
