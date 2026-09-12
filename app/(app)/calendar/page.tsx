"use client";

import { useMemo, useState } from "react";
import { addDays, addMonths, isSameDay, isSameMonth, startOfMonth, startOfWeek } from "date-fns";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

export default function CalendarPage() {
  // 보고 있는 달. 날짜가 아니라 달만 의미 있으므로 항상 1일로 맞춘다.
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [selected, setSelected] = useState<Date | null>(null);

  // 6주 42칸. 달마다 칸 수가 바뀌면 높이가 출렁이므로 항상 42칸으로 고정한다.
  const days = useMemo(() => {
    const gridStart = startOfWeek(cursor, { weekStartsOn: 0 });
    return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  }, [cursor]);

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
        <button
          onClick={() => setCursor((c) => addMonths(c, 1))}
          aria-label="다음 달"
          className="h-11 w-11 rounded-full text-2xl text-[#c5a8b2] transition active:scale-90"
        >
          ›
        </button>
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

          return (
            <button
              key={day.toISOString()}
              onClick={() => setSelected(day)}
              className={[
                "relative aspect-square rounded-xl text-sm transition active:scale-95",
                inMonth ? "" : "opacity-25",
                isSelected ? "bg-[#ff8fab] font-semibold text-white" : "bg-white/60",
                isToday && !isSelected ? "ring-2 ring-[#ff8fab]" : "",
              ].join(" ")}
            >
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                {day.getDate()}
              </span>
            </button>
          );
        })}
      </div>
    </main>
  );
}
