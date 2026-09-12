"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { GATE_KEY, nameOf, readMe, type PersonId } from "@/lib/me";

export default function CalendarPage() {
  const router = useRouter();
  const [me, setMe] = useState<PersonId | null>(null);

  useEffect(() => {
    const who = readMe();
    if (localStorage.getItem(GATE_KEY) !== "ok" || !who) {
      router.replace("/");
      return;
    }
    setMe(who);
  }, [router]);

  if (!me) return <main className="min-h-dvh" />;

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-2">
      <p className="text-lg">안녕 {nameOf(me)}</p>
      <p className="text-sm opacity-50">캘린더는 5단계에서</p>
    </main>
  );
}
