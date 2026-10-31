import { createClient } from "@/lib/supabase/server";
import QuickCapture from "./QuickCapture";
import ItemRow from "./ItemRow";
import { signOut } from "./actions";

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
    <main className="mx-auto max-w-2xl space-y-8 p-6" dir="rtl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">خلاصه امروز</h1>
        <form action={signOut}>
          <button className="text-sm text-neutral-500 underline">
            خروج ({user?.email})
          </button>
        </form>
      </div>

      <section className="rounded-xl bg-neutral-50 p-4">
        <p className="text-sm">
          {pendingTasks.length > 0
            ? `${pendingTasks.length} کار باز داری. مهم‌ترینش رو اول انجام بده.`
            : "هیچ کار بازی نداری. خیالت راحت باشه 🎉"}
        </p>
      </section>

      <QuickCapture />

      {all.length === 0 ? (
        <p className="text-center text-sm text-neutral-500">
          هنوز چیزی ثبت نکردی. از بالا شروع کن.
        </p>
      ) : (
        <div className="space-y-6">
          {KIND_ORDER.map((kind) => {
            const group = all.filter((i) => i.kind === kind);
            if (group.length === 0) return null;
            return (
              <div key={kind} className="space-y-2">
                <h2 className="text-sm font-semibold text-neutral-500">
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
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
