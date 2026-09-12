import { supabase } from "./supabase";
import type { PersonId } from "./me";

export type Poke = {
  id: string;
  sender: PersonId;
  recipient: PersonId;
  created_at: string;
};

export async function sendPoke(sender: PersonId, recipient: PersonId) {
  const { error } = await supabase.from("pokes").insert({ sender, recipient });
  if (error) throw error;
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
