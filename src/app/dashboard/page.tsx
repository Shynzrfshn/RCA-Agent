import { createClient } from "@/lib/supabase/server";
import QuickCapture from "./QuickCapture";
import ItemRow from "./ItemRow";
import { signOut } from "./actions";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: items } = await supabase
    .from("items")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  const pendingTasks = (items ?? []).filter(
    (i) => i.kind === "task" && !i.done,
  );

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

      <ul className="space-y-2">
        {(items ?? []).map((item) => (
          <ItemRow
            key={item.id}
            id={item.id}
            content={item.content}
            kind={item.kind}
            done={item.done}
          />
        ))}
      </ul>
    </main>
  );
}
