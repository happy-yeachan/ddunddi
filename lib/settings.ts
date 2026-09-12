import { supabase } from "./supabase";

export async function loadRelationshipDate() {
  const { data, error } = await supabase.from("app_settings").select("relationship_date").eq("id", 1).maybeSingle();
  if (error) throw error;
  return (data?.relationship_date as string | null) ?? null;
}

export async function saveRelationshipDate(date: string) {
  const { error } = await supabase.from("app_settings").upsert({ id: 1, relationship_date: date || null });
  if (error) throw error;
}
