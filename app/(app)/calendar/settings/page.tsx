"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { loadRelationshipDate, saveRelationshipDate } from "@/lib/settings";

export default function CalendarSettings() {
  const router = useRouter();
  const [date, setDate] = useState("");
  const [anniversaries, setAnniversaries] = useState(true);
  const [birthdays, setBirthdays] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let alive = true;
    setLoading(true); setLoaded(false); setError("");
    loadRelationshipDate().then((s) => {
      if (!alive) return;
      setDate(s.date ?? ""); setAnniversaries(s.anniversaries); setBirthdays(s.birthdays);
      setLoaded(true);
    }).catch(() => alive && setError("설정을 불러오지 못했어요. 다시 방문해주세요.")).finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [retry]);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (loading || saving || !loaded) return;
    setSaving(true); setError("");
    try { await saveRelationshipDate(date, anniversaries, birthdays); router.push("/calendar"); }
    catch (e) { setError(e instanceof Error ? e.message : "저장하지 못했어요"); }
    finally { setSaving(false); }
  }
  return <main className="mx-auto max-w-md px-6 py-8 pt-[calc(2rem+env(safe-area-inset-top))]">
    <Link href="/calendar" className="text-sm text-[#a45d73]">← 캘린더로</Link>
    <h1 className="mb-6 mt-5 text-2xl font-bold">캘린더 설정</h1>
    <form onSubmit={save} className="space-y-5 rounded-3xl bg-white p-5">
      <fieldset disabled={loading || saving || !loaded} className="space-y-5 disabled:opacity-50">
        <label className="block text-sm">사귄 날짜<input inputMode="numeric" placeholder="YYYY-MM-DD" value={date} onChange={(e) => { const d=e.target.value.replace(/\D/g, "").slice(0,8); setDate([d.slice(0,4),d.slice(4,6),d.slice(6,8)].filter(Boolean).join("-")); }} className="mt-2 w-full rounded-xl border border-[#f5d0da] p-3" /></label>
        <p className="text-xs text-[#a87c8d]">사귄 날짜가 없어도 생일 표시를 설정할 수 있어요.</p>
        <label className="flex items-center justify-between text-sm">기념일 표시<input type="checkbox" checked={anniversaries} onChange={(e) => setAnniversaries(e.target.checked)} /></label>
        <label className="flex items-center justify-between text-sm">생일 표시<input type="checkbox" checked={birthdays} onChange={(e) => setBirthdays(e.target.checked)} /></label>
        <p className="text-xs leading-5 text-[#a87c8d]">두 사람에게 함께 적용돼요. 대한민국 공휴일은 항상 표시해요.</p>
        <button className="w-full rounded-2xl bg-[#ff8fab] py-3 font-semibold text-white">{loading ? "불러오는 중…" : saving ? "저장 중…" : "설정 저장"}</button>
      </fieldset>
      {error && <p role="alert" className="text-sm text-[#a45270]">{error}</p>}
      {!loaded && !loading && <button type="button" onClick={() => setRetry((v) => v + 1)} className="text-sm underline">다시 불러오기</button>}
    </form>
  </main>;
}
