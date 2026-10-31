"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function addItem(content: string, kind: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("not authenticated");

  await supabase.from("items").insert({
    user_id: user.id,
    content,
    kind,
  });

  revalidatePath("/dashboard");
}

export async function toggleItem(id: string, done: boolean) {
  const supabase = await createClient();
  await supabase.from("items").update({ done }).eq("id", id);
  revalidatePath("/dashboard");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
}
