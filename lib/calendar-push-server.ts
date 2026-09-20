import { supabase } from "./supabase";
import { parseDay } from "./calendar-dates";
import type { PersonId } from "./me";

export async function calendarClaims(sender: PersonId, date: unknown, input: unknown) {
  if (typeof date !== "string" || !parseDay(date) || !input || typeof input !== "object") throw new Error("Invalid calendar additions");
  const additions = input as Record<string, unknown>;
  const lists = ["events", "photos", "notes"].map((kind) => {
    const list = additions[kind];
    if (!Array.isArray(list) || list.length > 100 || list.some((item) => typeof item !== "string" || item.length > 160)) throw new Error("Invalid calendar additions");
    return [...new Set(list)] as string[];
  });
  const [eventIds, paths, noteIds] = lists;
  const uuid = /^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i;
  if ([...eventIds, ...noteIds].some((id) => !uuid.test(id))) throw new Error("Invalid IDs");
  const verified: string[] = [];
  if (eventIds.length) {
    const { data, error } = await supabase.from("events").select("id").eq("date", date).eq("author", sender).in("id", eventIds);
    if (error) throw error;
    verified.push(...(data ?? []).map((row) => `event:${row.id}`));
  }
  if (paths.length || noteIds.length) {
    const { data: day, error } = await supabase.from("dates").select("id").eq("date", date).maybeSingle();
    if (error) throw error;
    if (day && paths.length) {
      const { data, error: photoError } = await supabase.from("date_photos").select("id").eq("date_id", day.id).in("path", paths);
      if (photoError) throw photoError;
      verified.push(...(data ?? []).map((row) => `photo:${row.id}`));
    }
    if (day && noteIds.length) {
      const { data, error: noteError } = await supabase.from("date_notes").select("id").eq("date_id", day.id).eq("author", sender).in("id", noteIds);
      if (noteError) throw noteError;
      verified.push(...(data ?? []).map((row) => `note:${row.id}`));
    }
  }
  if (!verified.length) return { date, summary: "" };
  const { data, error } = await supabase.rpc("claim_calendar_notifications", { resource_keys: verified });
  if (error) throw error;
  const claimed = (data ?? []) as string[];
  const summary = [["event:", "일정"], ["photo:", "사진"], ["note:", "일기"]]
    .filter(([prefix]) => claimed.some((id) => id.startsWith(prefix))).map(([, label]) => label).join("·");
  return { date, summary };
}
