"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { addDays, addMonths, endOfMonth, parseISO, isSameDay, isSameMonth, startOfMonth, startOfWeek } from "date-fns";
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
import { anniversaryLabels, isBirthdayOn, parseDay } from "@/lib/calendar-dates";
import { useToday } from "@/lib/use-today";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

export default function CalendarPage() {
  return <Suspense fallback={<p className="py-10 text-center">캘린더를 불러오는 중…</p>}><CalendarContent /></Suspense>;
}

function CalendarContent() {
  const searchParams = useSearchParams();
  const requestedDate = searchParams.get("date");
  const todayKey = useToday();
  const [revision, setRevision] = useState(0);
  const requestId = useRef(0);
  const [dataError, setDataError] = useState("");
  const [dataLoading, setDataLoading] = useState(true);
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
    const day = parseDay(requestedDate);
    if (day) { setCursor(startOfMonth(day)); setSelected(day); }
  }, [requestedDate]);
  useEffect(() => {
    const refreshOnFocus = () => { if (document.visibilityState === "visible") setRevision((v) => v + 1); };
    window.addEventListener("focus", refreshOnFocus);
    return () => window.removeEventListener("focus", refreshOnFocus);
  }, []);
  useEffect(() => {
    if (!me) return;
    const other = (me === "yeachan" ? "daeun" : "yeachan") as PersonId;
    let alive = true;
    Promise.allSettled([loadProfile(other, me), loadProfile(me, other), loadRelationshipDate()]).then(([self, partner, settings]) => {
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
  }, [me, revision]);


  // 6주 42칸. 달마다 칸 수가 바뀌면 높이가 출렁이므로 항상 42칸으로 고정한다.
  const days = useMemo(() => {
    const gridStart = startOfWeek(cursor, { weekStartsOn: 0 });
    return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  }, [cursor]);

  useEffect(() => {
    const controller = new AbortController();
    const years = [...new Set(days.map((day) => day.getFullYear()))];
    setHolidays({}); setHolidayError("");
    Promise.allSettled(years.map(async (year) => {
      const response = await fetch(`/api/holidays?year=${year}`, { signal: controller.signal });
      if (!response.ok) throw new Error("공휴일 조회 실패");
      return await response.json() as Record<string, string[]>;
    })).then((results) => {
      if (controller.signal.aborted) return;
      setHolidays(Object.assign({}, ...results.flatMap((r) => r.status === "fulfilled" ? [r.value] : [])));
      const unavailable = years.filter((_, i) => results[i].status === "rejected");
      if (unavailable.length) setHolidayError(`${unavailable.join(", ")}년 공휴일 정보를 불러오지 못했어요. 확인된 연도는 표시합니다.`);
    });
    return () => controller.abort();
  }, [days, revision]);

  // 이번 달이 아니라 화면에 보이는 42칸 범위를 통째로 읽는다. 앞뒤 달 칸에도
  // 기록이 있으면 썸네일이 보여야 한다.
  const refresh = useCallback(async () => {
    const current = ++requestId.current;
    setDataLoading(true); setDataError("");
    setCovers(new Map()); setDayEvents(new Map()); setSummary(null);
    const from = dateKey(days[0]);
    const to = dateKey(days[41]);
    // 격자는 앞뒤 달 칸을 포함하지만 요약은 그 달만 센다.
    const monthFrom = dateKey(startOfMonth(cursor));
    const monthTo = dateKey(endOfMonth(cursor));

    const [month, events, stats] = await Promise.allSettled([
      loadMonth(from, to),
      loadEvents(from, to),
      loadMonthSummary(monthFrom, monthTo),
    ]);
    // 부가 정보다. 하나가 실패해도 캘린더 자체는 계속 쓸 수 있어야 한다.
    if (current !== requestId.current) return;
    setCovers(month.status === "fulfilled" ? month.value : new Map());
    setDayEvents(events.status === "fulfilled" ? events.value : new Map());
    setSummary(stats.status === "fulfilled" ? stats.value : null);
    if ([month, events, stats].some((r) => r.status === "rejected")) setDataError("일부 기록을 불러오지 못했어요.");
    setDataLoading(false);
  }, [days, cursor]);

  useEffect(() => {
    refresh();
    return () => { requestId.current++; };
  }, [refresh, revision]);

  const today = parseISO(todayKey);

  return (
    <main className="mx-auto max-w-md px-4 pt-[calc(1rem+env(safe-area-inset-top))]">
      <div className="flex justify-between"><button onClick={() => setCursor(startOfMonth(today))} className="rounded-full bg-white px-4 py-2 text-sm text-app-text">이번 달</button><Link href="/calendar/settings" aria-label="캘린더 설정" className="rounded-full bg-white px-4 py-2 text-sm text-app-text">⚙ 설정</Link></div>
      <header className="flex items-center justify-between py-3">
        <button
          onClick={() => setCursor((c) => addMonths(c, -1))}
          aria-label="이전 달"
          className="h-11 w-11 rounded-full text-2xl text-app-muted transition active:scale-90"
        >
          ‹
        </button>
        <h1 className="text-lg font-bold tracking-tight">
          {cursor.getFullYear()}년 {cursor.getMonth() + 1}월
        </h1>
        <div className="flex items-center gap-1">
          <button onClick={() => setCursor((c) => addMonths(c, 1))} aria-label="다음 달" className="h-11 w-8 text-2xl text-app-muted transition active:scale-90">›</button>
        </div>
      </header>
      {settingsError && <p role="alert" className="mb-3 text-sm text-[#a45270]">{settingsError}</p>}
      {holidayError && <p role="status" className="mb-3 text-xs text-[#a45270]">{holidayError}</p>}
      {(dataError || settingsError || holidayError) && <div className="mb-3 text-sm text-[#a45270]">{dataError}<button onClick={() => setRevision((v) => v + 1)} className="ml-2 underline">다시 불러오기</button></div>}
      <p role="status" className="mb-1 min-h-4 text-center text-xs text-app-muted">{dataLoading ? "기록을 불러오는 중…" : ""}</p>

      <div className="grid grid-cols-7">
        {WEEKDAYS.map((w, i) => (
          <div
            key={w}
            className={`pb-2 text-center text-xs font-medium ${
              i === 0 ? "text-[#e8879b]" : i === 6 ? "text-[#8fa8d8]" : "text-app-muted"
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
          const isBirthday = showBirthdays && birthdays.some((date) => isBirthdayOn(date, day));
          const holidayNames = holidays[dKey] ?? [];
          const labels: string[] = isBirthday ? ["🎂"] : [];
          if (showAnniversaries) labels.push(...anniversaryLabels(relationshipDate, day));
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
                isSelected ? "bg-app-accent font-semibold text-app-on-accent" : "bg-white/60",
                isToday && !isSelected ? "ring-2 ring-app-accent" : "",
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
                  isSelected ? "" : holidayNames.length || day.getDay() === 0 ? (cover ? "rounded bg-white/95 px-1 font-semibold text-red-600" : "font-semibold text-red-600") : cover ? "font-semibold text-white" : day.getDay() === 6 ? "text-[#6684b5]" : "",
                ].join(" ")}
              >
                {day.getDate()}
              </span>

              {/* 일기 밑줄. 숫자 span 은 absolute 로 가운데 고정돼 있어
                  그 안에 넣으면 position 이 충돌한다. 형제로 둔다. */}
              {entry && (
                <span
                  className={`absolute left-1/2 top-[64%] h-[2px] w-3 -translate-x-1/2 rounded-full ${
                    cover ? "bg-white" : "bg-app-accent"
                  }`}
                />
              )}
              {eventLabel && <span title={eventLabel} className="absolute inset-x-0 bottom-0 rounded bg-white/95 px-0.5 text-[9px] leading-tight text-app-text">{eventLabel}</span>}
            </button>
          );
        })}
      </div>

      {Object.keys(holidays).some((date) => date.startsWith(dateKey(cursor).slice(0, 7))) && <ul className="mt-4 space-y-1 text-xs text-red-600" aria-label="이번 달 공휴일">{Object.entries(holidays).filter(([date]) => date.startsWith(dateKey(cursor).slice(0, 7))).sort(([a], [b]) => a.localeCompare(b)).map(([date, names]) => <li key={date}>{Number(date.slice(8))}일 · {names.join(" · ")}</li>)}</ul>}

      <div className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] text-app-muted">
        <Legend color="var(--app-accent)" shape="bar" text="일기" />
        <Legend color={OWNER_COLOR.both} text="같이" />
        <Legend color={OWNER_COLOR[me ?? "yeachan"]} text="내 일정" />
        <Legend color={OWNER_COLOR[me === "yeachan" ? "daeun" : "yeachan"]} text="상대 일정" />
      </div>

      {summary && (
        <section className="mt-6 rounded-2xl border border-app-border bg-white px-4 py-4">
          <h2 className="mb-3 text-xs font-medium text-app-muted">
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

              <p className="mt-3 border-t border-app-border pt-3 text-xs leading-5 text-app-muted">
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
          key={dateKey(selected)}
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
      <p className="text-xl font-bold text-app-accent">
        {n}
        <span className="ml-0.5 text-xs font-medium">{unit}</span>
      </p>
      <p className="mt-0.5 text-[11px] text-app-muted">{label}</p>
    </div>
  );
}
