import { createClient } from "@/lib/supabase/server";
import QuickCapture from "./QuickCapture";
import ItemRow from "./ItemRow";
import { signOut } from "./actions";

export const instant = false;

const KIND_ORDER = ["task", "reminder", "note", "idea"] as const;
const KIND_LABELS: Record<string, string> = {
  task: "کارها",
  reminder: "یادآوری‌ها",
  note: "یادداشت‌ها",
  idea: "ایده‌ها",
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: items } = await supabase
    .from("items")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  const all = items ?? [];
  const pendingTasks = all.filter((i) => i.kind === "task" && !i.done);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-6 py-4">
          <h1 className="font-bold">RCA Agent</h1>
          <form action={signOut}>
            <button
              type="submit"
              className="rounded-md px-2 py-1 text-sm text-muted underline-offset-2 hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring"
            >
              خروج ({user?.email})
            </button>
          </form>
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

        <QuickCapture />

        {all.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border py-10 text-center text-sm text-muted">
            هنوز چیزی ثبت نکردی. از بالا شروع کن.
          </p>
        ) : (
          <div className="space-y-6">
            {KIND_ORDER.map((kind) => {
              const group = all.filter((i) => i.kind === kind);
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
                        id={item.id}
                        content={item.content}
                        kind={item.kind}
                        done={item.done}
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
