import { addDays, addYears, differenceInCalendarDays, format, isValid, parseISO } from "date-fns";

export function parseDay(value: string | null | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = parseISO(value);
  return isValid(date) && format(date, "yyyy-MM-dd") === value ? date : null;
}

// 2월 29일은 평년 2월 28일에 표시한다. 홈과 캘린더가 같은 기준을 쓴다.
export function annualDate(value: string, year: number): Date | null {
  const original = parseDay(value);
  return original && year >= original.getFullYear() ? addYears(original, year - original.getFullYear()) : null;
}

export function isBirthdayOn(birthday: string, day: Date) {
  const date = annualDate(birthday, day.getFullYear());
  return date !== null && differenceInCalendarDays(day, date) === 0;
}

export function anniversaryLabels(startKey: string | null, day: Date): string[] {
  const start = parseDay(startKey);
  if (!start) return [];
  const days = differenceInCalendarDays(day, start) + 1;
  if (days < 1) return [];
  const labels: string[] = [];
  if (days === 1) labels.push("♥ 사귄 날");
  if (days % 100 === 0) labels.push(`${days}일`);
  const years = day.getFullYear() - start.getFullYear();
  if (years > 0 && differenceInCalendarDays(day, addYears(start, years)) === 0) labels.push(`${years}주년`);
  return labels;
}

type SpecialDay = { id: string; label: string; date: Date; at?: string | null };
type Event = { id: string; title: string; date: string; at: string | null; done: boolean };
type Birthday = { subject: string; name: string; birth_date: string | null };

export function upcomingSpecialDays(today: Date, events: Event[], profiles: Birthday[], settings: { date: string | null; anniversaries: boolean; birthdays: boolean } | null): SpecialDay[] {
  const upcoming: SpecialDay[] = [];
  for (const event of events) {
    const date = parseDay(event.date);
    if (date && !event.done && differenceInCalendarDays(date, today) >= 0) upcoming.push({ id: `event:${event.id}`, label: event.title, date, at: event.at });
  }
  const start = parseDay(settings?.date);
  if (start && settings?.anniversaries) {
    const elapsed = differenceInCalendarDays(today, start) + 1;
    if (elapsed <= 1) upcoming.push({ id: "start", label: "우리 사귄 날", date: start });
    const first = Math.max(100, Math.ceil(elapsed / 100) * 100);
    // 100일 다음의 200일이 1주년보다 가까울 수 있어 세 후보를 모두 비교한다.
    for (let count = first; count < first + 300; count += 100) upcoming.push({ id: `days:${count}`, label: `우리 ${count}일`, date: addDays(start, count - 1) });
    let years = Math.max(1, today.getFullYear() - start.getFullYear());
    if (differenceInCalendarDays(addYears(start, years), today) < 0) years++;
    upcoming.push({ id: `years:${years}`, label: `우리 ${years}주년`, date: addYears(start, years) });
  }
  if (settings?.birthdays) for (const profile of profiles) {
    if (!profile.birth_date) continue;
    let date = annualDate(profile.birth_date, today.getFullYear());
    if (!date) continue;
    if (differenceInCalendarDays(date, today) < 0) date = annualDate(profile.birth_date, today.getFullYear() + 1);
    if (date) upcoming.push({ id: `birthday:${profile.subject}`, label: `🎂 ${profile.name} 생일`, date });
  }
  return upcoming.sort((a, b) => a.date.getTime() - b.date.getTime() || (a.at ?? "99:99").localeCompare(b.at ?? "99:99") || a.id.localeCompare(b.id)).slice(0, 3);
}
