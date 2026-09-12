"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { addDays, addMonths, differenceInCalendarDays, endOfMonth, parseISO, isSameDay, isSameMonth, startOfMonth, startOfWeek } from "date-fns";
import DateSheet, { OWNER_COLOR } from "@/components/DateSheet";
import {
  dateKey,
  loadEvents,
  loadMonth,
  loadMonthSummary,
  type EventItem,
  type MonthSummary,
} from "@/lib/records";
import { photoUrl } from "@/lib/supabase";
import { readMe, type PersonId } from "@/lib/me";
import { loadProfile } from "@/lib/profiles";
import { loadRelationshipDate } from "@/lib/settings";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

export default function CalendarPage() {
  // 보고 있는 달. 날짜가 아니라 달만 의미 있으므로 항상 1일로 맞춘다.
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [selected, setSelected] = useState<Date | null>(null);
  const [me, setMe] = useState<PersonId | null>(null);
  const [relationshipDate, setRelationshipDate] = useState<string | null>(null);
  const [birthdays, setBirthdays] = useState<string[]>([]);
  const [showAnniversaries, setShowAnniversaries] = useState(true);
  const [showBirthdays, setShowBirthdays] = useState(true);
  const [settingsError, setSettingsError] = useState("");
  const [holidays, setHolidays] = useState<Record<string, string[]>>({});
  const [holidayError, setHolidayError] = useState("");

  // date 문자열 → { id, cover }. 화면에 보이는 42칸 전체를 담는다.
  const [covers, setCovers] = useState<Map<string, { cover: string | null }>>(new Map());
  const [dayEvents, setDayEvents] = useState<Map<string, EventItem[]>>(new Map());
  const [summary, setSummary] = useState<MonthSummary | null>(null);

  // 레이아웃 가드가 이미 통과시킨 뒤라 값이 있다.
  useEffect(() => setMe(readMe()), []);
  useEffect(() => {
    if (!me) return;
    const other = (me === "yeachan" ? "daeun" : "yeachan") as PersonId;
    let alive = true;
    Promise.allSettled([loadProfile(me, me), loadProfile(me, other), loadRelationshipDate()]).then(([self, partner, settings]) => {
      if (!alive) return;
      setBirthdays([self.status === "fulfilled" ? self.value?.birth_date : null, partner.status === "fulfilled" ? partner.value?.birth_date : null].filter(Boolean) as string[]);
      if (settings.status === "fulfilled") {
        setRelationshipDate(settings.value.date);
        setShowAnniversaries(settings.value.anniversaries);
        setShowBirthdays(settings.value.birthdays);
        setSettingsError("");
      } else setSettingsError("기념일 설정을 불러오지 못했어요. 저장 상태를 확인해주세요.");
    });
    return () => { alive = false; };
  }, [me]);


  // 6주 42칸. 달마다 칸 수가 바뀌면 높이가 출렁이므로 항상 42칸으로 고정한다.
  const days = useMemo(() => {
    const gridStart = startOfWeek(cursor, { weekStartsOn: 0 });
    return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  }, [cursor]);

  useEffect(() => {
    const controller = new AbortController();
    const years = [...new Set(days.map((day) => day.getFullYear()))];
    setHolidays({}); setHolidayError("");
    Promise.all(years.map(async (year) => {
      const response = await fetch(`/api/holidays?year=${year}`, { signal: controller.signal });
      if (!response.ok) throw new Error("공휴일 조회 실패");
      return await response.json() as Record<string, string[]>;
    })).then((data) => { if (!controller.signal.aborted) setHolidays(Object.assign({}, ...data)); })
      .catch(() => { if (!controller.signal.aborted) setHolidayError("공휴일 정보를 불러오지 못했어요. 해당 연도 자료가 아직 없을 수 있어요."); });
    return () => controller.abort();
  }, [days]);

  // 이번 달이 아니라 화면에 보이는 42칸 범위를 통째로 읽는다. 앞뒤 달 칸에도
  // 기록이 있으면 썸네일이 보여야 한다.
  const refresh = useCallback(async () => {
    const from = dateKey(days[0]);
    const to = dateKey(days[41]);
    // 격자는 앞뒤 달 칸을 포함하지만 요약은 그 달만 센다.
    const monthFrom = dateKey(startOfMonth(cursor));
    const monthTo = dateKey(endOfMonth(cursor));

    const [month, events, stats] = await Promise.all([
      loadMonth(from, to).catch(() => new Map()),
      loadEvents(from, to).catch(() => new Map()),
      loadMonthSummary(monthFrom, monthTo).catch(() => null),
    ]);
    // 부가 정보다. 하나가 실패해도 캘린더 자체는 계속 쓸 수 있어야 한다.
    setCovers(month);
    setDayEvents(events);
    setSummary(stats);
  }, [days, cursor]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const today = new Date();

  return (
    <main className="mx-auto max-w-md px-4 pt-[calc(1rem+env(safe-area-inset-top))]">
      <div className="flex justify-end"><Link href="/calendar/settings" aria-label="캘린더 설정" className="rounded-full bg-white px-4 py-2 text-sm text-[#a45d73]">⚙ 설정</Link></div>
      <header className="flex items-center justify-between py-3">
        <button
          onClick={() => setCursor((c) => addMonths(c, -1))}
          aria-label="이전 달"
          className="h-11 w-11 rounded-full text-2xl text-[#c5a8b2] transition active:scale-90"
        >
          ‹
        </button>
        <h1 className="text-lg font-bold tracking-tight">
          {cursor.getFullYear()}년 {cursor.getMonth() + 1}월
        </h1>
        <div className="flex items-center gap-1">
          <button onClick={() => setCursor((c) => addMonths(c, 1))} aria-label="다음 달" className="h-11 w-8 text-2xl text-[#c5a8b2] transition active:scale-90">›</button>
        </div>
      </header>
      {settingsError && <p role="alert" className="mb-3 text-sm text-[#a45270]">{settingsError}</p>}
      {holidayError && <p role="status" className="mb-3 text-xs text-[#a45270]">{holidayError}</p>}

      <div className="grid grid-cols-7">
        {WEEKDAYS.map((w, i) => (
          <div
            key={w}
            className={`pb-2 text-center text-xs font-medium ${
              i === 0 ? "text-[#e8879b]" : i === 6 ? "text-[#8fa8d8]" : "text-[#bda5ae]"
            }`}
          >
            {w}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const inMonth = isSameMonth(day, cursor);
          const isToday = isSameDay(day, today);
          const isSelected = selected && isSameDay(day, selected);
          const dKey = dateKey(day);
          const entry = covers.get(dKey);
          const cover = entry?.cover ?? null;
          const evs = dayEvents.get(dKey) ?? [];
          const key = dateKey(day).slice(5);
          const isBirthday = showBirthdays && birthdays.some((date) => date.slice(5) === key);
          const start = relationshipDate ? parseISO(relationshipDate) : null;
          const anniversaryDays = start ? differenceInCalendarDays(day, start) + 1 : 0;
          const holidayNames = holidays[dKey] ?? [];
          const labels: string[] = isBirthday ? ["🎂"] : [];
          if (showAnniversaries && start && anniversaryDays > 0) {
            if (anniversaryDays === 1) labels.push("♥ 사귄 날");
            if (anniversaryDays % 100 === 0) labels.push(`${anniversaryDays}일`);
            const years = day.getFullYear() - start.getFullYear();
            if (years > 0 && day.getMonth() === start.getMonth() && day.getDate() === start.getDate()) labels.push(`${years}주년`);
          }
          const eventLabel = labels.join(" · ");

          return (
            <button
              key={day.toISOString()}
              aria-label={`${dKey}${isBirthday ? " 생일" : ""} ${holidayNames.join(", ")} ${eventLabel}`}
              title={holidayNames.join(", ")}
              onClick={() => setSelected(day)}
              className={[
                "relative aspect-square overflow-hidden rounded-xl text-sm transition active:scale-95",
                inMonth ? "" : "opacity-25",
                isSelected ? "bg-[#ff8fab] font-semibold text-white" : "bg-white/60",
                isToday && !isSelected ? "ring-2 ring-[#ff8fab]" : "",
              ].join(" ")}
            >
              {cover && (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photoUrl(cover)}
                    alt=""
                    loading="lazy"
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                  {/* 사진 위에서도 날짜가 읽히도록 어둡게 깐다. */}
                  <span className="absolute inset-0 bg-black/40" />
                </>
              )}

              {/* 점은 일정만 쓴다. 색은 아래 범례와 같다.
                  일기는 숫자 밑줄로 구분해 점과 섞이지 않게 했다. */}
              {evs.length > 0 && (
                <span className="absolute inset-x-0 top-1 flex justify-center gap-0.5">
                  {evs.slice(0, 3).map((e) => (
                    <span
                      key={e.id}
                      className="h-1.5 w-1.5 rounded-full"
                      style={{
                        backgroundColor: OWNER_COLOR[e.owner],
                        opacity: e.done ? 0.35 : 1,
                      }}
                    />
                  ))}
                </span>
              )}

              <span
                className={[
                  "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2",
                  "relative",
                  isSelected ? "" : holidayNames.length || day.getDay() === 0 ? (cover ? "rounded bg-white/95 px-1 font-semibold text-red-600" : "font-semibold text-red-600") : cover ? "font-semibold text-white" : day.getDay() === 6 ? "text-[#6684b5]" : "",
                ].join(" ")}
              >
                {day.getDate()}
                {entry && (
                  <span
                    className={`absolute -bottom-1 left-1/2 h-[2px] w-3 -translate-x-1/2 rounded-full ${
                      cover ? "bg-white" : "bg-[#ff8fab]"
                    }`}
                  />
                )}
              </span>
              {eventLabel && <span title={eventLabel} className="absolute inset-x-0 bottom-0 rounded bg-white/95 px-0.5 text-[9px] leading-tight text-[#a84367]">{eventLabel}</span>}
            </button>
          );
        })}
      </div>

      {Object.keys(holidays).some((date) => date.startsWith(dateKey(cursor).slice(0, 7))) && <ul className="mt-4 space-y-1 text-xs text-red-600" aria-label="이번 달 공휴일">{Object.entries(holidays).filter(([date]) => date.startsWith(dateKey(cursor).slice(0, 7))).sort(([a], [b]) => a.localeCompare(b)).map(([date, names]) => <li key={date}>{Number(date.slice(8))}일 · {names.join(" · ")}</li>)}</ul>}

      <div className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] text-[#bda5ae]">
        <Legend color="#ff8fab" shape="bar" text="일기" />
        <Legend color={OWNER_COLOR.both} text="같이" />
        <Legend color={OWNER_COLOR[me ?? "yeachan"]} text="내 일정" />
        <Legend color={OWNER_COLOR[me === "yeachan" ? "daeun" : "yeachan"]} text="상대 일정" />
      </div>

      {summary && (
        <section className="mt-6 rounded-2xl border border-[#f5d0da] bg-white px-4 py-4">
          <h2 className="mb-3 text-xs font-medium text-[#bda5ae]">
            {cursor.getMonth() + 1}월 돌아보기
          </h2>

          {summary.days === 0 && summary.events === 0 ? (
            <p className="py-2 text-center text-sm text-[#d8b6c0]">
              이 달은 아직 비어 있어요
            </p>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2 text-center">
                <Stat n={summary.days} unit="일" label="기록한 날" />
                <Stat n={summary.photos} unit="장" label="사진" />
                <Stat n={summary.events} unit="개" label="일정" />
              </div>

              <p className="mt-3 border-t border-[#f7edf1] pt-3 text-xs leading-5 text-[#b28c99]">
                {summary.bothDays > 0
                  ? `둘 다 일기를 쓴 날이 ${summary.bothDays}일 있어요.`
                  : summary.notes > 0
                    ? "아직 둘 다 쓴 날은 없어요."
                    : "일기는 아직 비어 있어요."}
                {summary.events > 0 &&
                  ` 일정은 ${summary.events}개 중 ${summary.eventsDone}개 마쳤어요.`}
              </p>
            </>
          )}
        </section>
      )}

      {selected && me && (
        <DateSheet
          dateKey={dateKey(selected)}
          label={`${selected.getMonth() + 1}월 ${selected.getDate()}일`}
          me={me}
          onClose={() => setSelected(null)}
          onSaved={refresh}
        />
      )}
    </main>
  );
}

function Legend({
  color,
  text,
  shape = "dot",
}: {
  color: string;
  text: string;
  shape?: "dot" | "bar";
}) {
  return (
    <span className="flex items-center gap-1">
      <span
        className={shape === "bar" ? "h-[2px] w-3 rounded-full" : "h-1.5 w-1.5 rounded-full"}
        style={{ backgroundColor: color }}
      />
      {text}
    </span>
  );
}

function Stat({ n, unit, label }: { n: number; unit: string; label: string }) {
  return (
    <div>
      <p className="text-xl font-bold text-[#ff8fab]">
        {n}
        <span className="ml-0.5 text-xs font-medium">{unit}</span>
      </p>
      <p className="mt-0.5 text-[11px] text-[#bda5ae]">{label}</p>
    </div>
  );
}
