"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import QuickCapture from "./QuickCapture";
import ItemRow from "./ItemRow";

export type Item = {
  id: string;
  kind: string;
  content: string;
  done: boolean;
  created_at: string;
};

const KIND_ORDER = ["task", "reminder", "note", "idea"] as const;
const KIND_LABELS: Record<string, string> = {
  task: "کارها",
  reminder: "یادآوری‌ها",
  note: "یادداشت‌ها",
  idea: "ایده‌ها",
};

export default function DashboardPage() {
  const router = useRouter();
  const supabase = createClient();
  const [user, setUser] = useState<User | null>(null);
  const [items, setItems] = useState<Item[] | null>(null);

  const loadItems = useCallback(async () => {
    const { data } = await supabase
      .from("items")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    setItems((data as Item[]) ?? []);
  }, [supabase]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.replace("/login/");
        return;
      }
      setUser(session.user);
      if (window.location.search) {
        window.history.replaceState(null, "", window.location.pathname);
      }
      loadItems();
    });
  }, [supabase, router, loadItems]);

  async function addItem(content: string, kind: string) {
    if (!user) return;
    await supabase.from("items").insert({ user_id: user.id, content, kind });
    await loadItems();
  }

  async function toggleItem(id: string, done: boolean) {
    setItems((prev) =>
      prev ? prev.map((i) => (i.id === id ? { ...i, done } : i)) : prev,
    );
    await supabase.from("items").update({ done }).eq("id", id);
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login/");
  }

  if (!user || items === null) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted">
        در حال بارگذاری...
      </div>
    );
  }

  const pendingTasks = items.filter((i) => i.kind === "task" && !i.done);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-6 py-4">
          <h1 className="font-bold">RCA Agent</h1>
          <button
            type="button"
            onClick={signOut}
            className="rounded-md px-2 py-1 text-sm text-muted underline-offset-2 hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring"
          >
            خروج ({user.email})
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-8 px-6 py-8">
        <section
          className="rounded-xl border border-border bg-surface p-4"
          aria-live="polite"
        >
          <p className="text-sm">
            {pendingTasks.length > 0
              ? `${pendingTasks.length} کار باز داری. مهم‌ترینش رو اول انجام بده.`
              : "هیچ کار بازی نداری. خیالت راحت باشه 🎉"}
          </p>
        </section>

        <QuickCapture onAdd={addItem} />

        {items.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border py-10 text-center text-sm text-muted">
            هنوز چیزی ثبت نکردی. از بالا شروع کن.
          </p>
        ) : (
          <div className="space-y-6">
            {KIND_ORDER.map((kind) => {
              const group = items.filter((i) => i.kind === kind);
              if (group.length === 0) return null;
              return (
                <section key={kind} className="space-y-2">
                  <h2 className="text-sm font-semibold text-muted">
                    {KIND_LABELS[kind]} ({group.length})
                  </h2>
                  <ul className="space-y-2">
                    {group.map((item) => (
                      <ItemRow
                        key={item.id}
                        content={item.content}
                        done={item.done}
                        onToggle={(done) => toggleItem(item.id, done)}
                      />
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
