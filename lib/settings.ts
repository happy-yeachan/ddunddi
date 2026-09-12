import { supabase } from "./supabase";
import { parseDay } from "./calendar-dates";

export async function loadRelationshipDate() {
  const { data, error } = await supabase.from("app_settings").select("relationship_date, show_anniversaries, show_birthdays").eq("id", 1).maybeSingle();
  if (error) throw error;
  return { date: (data?.relationship_date as string | null) ?? null, anniversaries: data?.show_anniversaries ?? true, birthdays: data?.show_birthdays ?? true };
}

export async function saveRelationshipDate(date: string, anniversaries = true, birthdays = true) {
  if (date && !parseDay(date)) {
    throw new Error("사귄 날짜를 YYYY-MM-DD 형식의 실제 날짜로 입력해주세요.");
  }
  const { error } = await supabase.from("app_settings").upsert({ id: 1, relationship_date: date || null, show_anniversaries: anniversaries, show_birthdays: birthdays });
  if (error) throw new Error(`설정을 저장하지 못했어요: ${error.message}`);
}
