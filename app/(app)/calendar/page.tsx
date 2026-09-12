"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { addDays, addMonths, isSameDay, isSameMonth, startOfMonth, startOfWeek } from "date-fns";
import DateSheet from "@/components/DateSheet";
import { dateKey, loadMonth } from "@/lib/records";
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

  // date 문자열 → { id, cover }. 화면에 보이는 42칸 전체를 담는다.
  const [covers, setCovers] = useState<Map<string, { cover: string | null }>>(new Map());

  // 레이아웃 가드가 이미 통과시킨 뒤라 값이 있다.
  useEffect(() => setMe(readMe()), []);
  useEffect(() => {
    if (!me) return;
    const other = (me === "yeachan" ? "daeun" : "yeachan") as PersonId;
    Promise.all([loadProfile(me, me), loadProfile(me, other), loadRelationshipDate()]).then(([self, partner, anniversary]) => {
      setBirthdays([self?.birth_date, partner?.birth_date].filter(Boolean) as string[]);
      setRelationshipDate(anniversary.date); setShowAnniversaries(anniversary.anniversaries); setShowBirthdays(anniversary.birthdays);
    }).catch(() => {});
  }, [me]);


  // 6주 42칸. 달마다 칸 수가 바뀌면 높이가 출렁이므로 항상 42칸으로 고정한다.
  const days = useMemo(() => {
    const gridStart = startOfWeek(cursor, { weekStartsOn: 0 });
    return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  }, [cursor]);

  // 이번 달이 아니라 화면에 보이는 42칸 범위를 통째로 읽는다. 앞뒤 달 칸에도
  // 기록이 있으면 썸네일이 보여야 한다.
  const refresh = useCallback(async () => {
    try {
      const map = await loadMonth(dateKey(days[0]), dateKey(days[41]));
      setCovers(map);
    } catch {
      // 썸네일은 부가 정보다. 실패해도 캘린더 자체는 계속 쓸 수 있어야 한다.
      setCovers(new Map());
    }
  }, [days]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const today = new Date();

  return (
    <main className="mx-auto max-w-md px-4 pt-[calc(1rem+env(safe-area-inset-top))]">
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
          const entry = covers.get(dateKey(day));
          const cover = entry?.cover ?? null;
          const key = dateKey(day).slice(5);
          const isBirthday = showBirthdays && birthdays.some((date) => date.slice(5) === key);
          const anniversaryDays = relationshipDate ? Math.floor((day.getTime() - new Date(`${relationshipDate}T00:00:00`).getTime()) / 86400000) : -1;
          const milestone = anniversaryDays >= 0 && (anniversaryDays === 0 || anniversaryDays % 100 === 0 || (day.getMonth() === new Date(`${relationshipDate}T00:00:00`).getMonth() && day.getDate() === new Date(`${relationshipDate}T00:00:00`).getDate()));
          const isAnniversary = showAnniversaries && milestone;
          const eventLabel = isBirthday ? "🎂 생일" : isAnniversary ? (anniversaryDays === 0 ? "사귄 날" : anniversaryDays % 100 === 0 ? `${anniversaryDays}일` : `${day.getFullYear() - new Date(`${relationshipDate}T00:00:00`).getFullYear()}주년`) : "";

          return (
            <button
              key={day.toISOString()}
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

              {/* 사진은 없고 메모만 있는 날 */}
              {!cover && entry && (
                <span className="absolute bottom-1.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-[#ff8fab]" />
              )}

              <span
                className={[
                  "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2",
                  cover && !isSelected ? "font-semibold text-white" : "",
                ].join(" ")}
              >
                {day.getDate()}
              </span>
              {eventLabel && <span title={eventLabel} className="absolute bottom-0 left-1/2 max-w-full -translate-x-1/2 truncate text-[8px] text-[#ff7092]">{eventLabel}</span>}
            </button>
          );
        })}
      </div>

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
