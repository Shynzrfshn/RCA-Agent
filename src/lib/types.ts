export type ItemKind = "task" | "reminder" | "note" | "idea";

export type Item = {
  id: string;
  kind: ItemKind;
  content: string;
  done: boolean;
  due_at: string | null;
  priority: number;
  recurrence: "daily" | "weekly" | "monthly" | null;
  source: "manual" | "agent" | "email";
  created_at: string;
};

export type Medication = {
  id: string;
  name: string;
  dosage: string | null;
  instructions: string | null;
  times: string[];
  days_of_week: number[] | null;
  start_date: string;
  end_date: string | null;
  stock: number | null;
  dose_amount: number;
  refill_threshold: number;
  color: string;
  active: boolean;
};

export type DoseStatus = "pending" | "taken" | "skipped" | "missed";

export type Dose = {
  id: string;
  medication_id: string;
  scheduled_for: string;
  status: DoseStatus;
  taken_at: string | null;
  medications: Pick<Medication, "name" | "dosage" | "instructions" | "color"> | null;
};

export type Email = {
  id: string;
  from_addr: string | null;
  subject: string | null;
  snippet: string | null;
  summary: string | null;
  category: "urgent" | "important" | "normal" | "promo" | "spam";
  action_needed: boolean;
  is_read: boolean;
  received_at: string | null;
};

export type EmailAccount = {
  id: string;
  email: string;
  last_synced_at: string | null;
  last_error: string | null;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

export type Profile = {
  user_id: string;
  display_name: string | null;
  timezone: string;
  briefing_hour: number;
  briefing_enabled: boolean;
  evening_hour: number;
  evening_enabled: boolean;
  weekly_day: number;
  nudges_enabled: boolean;
};

export const KIND_LABELS: Record<ItemKind, string> = {
  task: "کار",
  reminder: "یادآوری",
  note: "یادداشت",
  idea: "ایده",
};

export const PRIORITY_LABELS = ["کم", "عادی", "مهم", "فوری"];
