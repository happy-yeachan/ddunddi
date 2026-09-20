import { supabase } from "./supabase";
import type { PersonId } from "./me";

export type Poke = {
  id: string;
  sender: PersonId;
  recipient: PersonId;
  created_at: string;
};

export async function sendPoke(sender: PersonId, recipient: PersonId, id = crypto.randomUUID()) {
  if (sender === recipient) throw new Error("상대에게만 찌르기를 보낼 수 있어요.");
  const response = await fetch("/api/push", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "poke", person: sender, id }) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "찌르기를 전달하지 못했어요.");
  return data as { message: string };
}

export async function loadRecentPokes(limit = 20) {
  const { data, error } = await supabase
    .from("pokes")
    .select("id, sender, recipient, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as Poke[];
}
