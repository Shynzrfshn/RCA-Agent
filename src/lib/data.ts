import { createClient } from "@/lib/supabase/client";
import type { Dose, DoseStatus, Item } from "@/lib/types";

const db = () => createClient();

export function todayBounds() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

export async function loadDoses(fromIso: string, toIso: string): Promise<Dose[]> {
  // Materialize upcoming doses; ignore errors if the v2 migration isn't applied yet.
  await db().rpc("ensure_my_doses").then(() => undefined, () => undefined);
  const { data, error } = await db()
    .from("dose_logs")
    .select("id, medication_id, scheduled_for, status, taken_at, medications(name, dosage, instructions, color)")
    .gte("scheduled_for", fromIso)
    .lt("scheduled_for", toIso)
    .order("scheduled_for");
  if (error) throw error;
  return (data ?? []) as unknown as Dose[];
}

export async function setDoseStatus(id: string, status: DoseStatus) {
  const { error } = await db().rpc("set_dose_status", { p_log: id, p_status: status });
  if (error) throw error;
}

export async function loadOpenItems(): Promise<Item[]> {
  const { data, error } = await db()
    .from("items")
    .select("*")
    .eq("done", false)
    .order("due_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []) as Item[];
}

export async function completeItem(id: string, done = true) {
  const { error } = await db().rpc("complete_item", { p_id: id, p_done: done });
  if (error) {
    // Fallback for databases without the v2 migration.
    const { error: e2 } = await db().from("items").update({ done }).eq("id", id);
    if (e2) throw e2;
  }
}

export async function addItem(user_id: string, fields: Partial<Item> & { content: string }) {
  const { error } = await db()
    .from("items")
    .insert({ user_id, kind: "task", ...fields });
  if (error) throw error;
}
