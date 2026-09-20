export type CalendarAdditions = { events: string[]; photos: string[]; notes: string[] };

export async function notifyCalendar(person: string, date: string, additions: CalendarAdditions) {
  if (!additions.events.length && !additions.photos.length && !additions.notes.length) return;
  const response = await fetch("/api/push", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "calendar", person, date, additions }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error("기록은 저장했지만 상대에게 알림을 보내지 못했어요.");
  return data.message as string | undefined;
}
