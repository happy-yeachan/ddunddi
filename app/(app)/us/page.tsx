"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { parseDay, upcomingSpecialDays } from "@/lib/calendar-dates";
import { useToday } from "@/lib/use-today";
import { nameOf, readMe, type PersonId } from "@/lib/me";
import { loadProfile, type Profile } from "@/lib/profiles";
import { loadRelationshipDate } from "@/lib/settings";
import { dateKey, loadUpcoming, type EventItem } from "@/lib/records";
import { photoUrl } from "@/lib/supabase";

export default function UsPage() {
  const [me, setMe] = useState<PersonId | null>(null);
  const [profiles, setProfiles] = useState<(Profile | null)[]>([]);
  const [settings, setSettings] = useState<Awaited<ReturnType<typeof loadRelationshipDate>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [view, setView] = useState<(Profile | null)[] | null>(null);
  const [opening, setOpening] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const modal = dialog.current;
    if (view && modal && !modal.open) modal.showModal();
    return () => { if (modal?.open) modal.close(); };
  }, [view]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const todayKey = useToday();
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const refresh = () => { if (document.visibilityState === "visible") setRevision((v) => v + 1); };
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, []);

  useEffect(() => {
    let alive = true;
    const id = readMe();
    setMe(id);
    if (!id) return;
    const other = id === "yeachan" ? "daeun" : "yeachan";
    // 설정 조회 실패가 저장된 두 사람의 프로필까지 숨기지 않도록 각각 반영한다.
    // 일정은 부가 정보라 실패해도 화면을 막지 않는다.
    Promise.allSettled([loadProfile(other, id), loadProfile(id, other), loadRelationshipDate(), loadUpcoming(todayKey, 3)]).then((results) => {
      if (!alive) return;
      const [self, partner, dates, upcomingEvents] = results;
      if (upcomingEvents.status === "fulfilled") setEvents(upcomingEvents.value);
      setProfiles([self.status === "fulfilled" ? self.value : null, partner.status === "fulfilled" ? partner.value : null]);
      if (dates.status === "fulfilled") setSettings(dates.value);
      setError(results.some((r) => r.status === "rejected") ? "일부 정보를 불러오지 못했어요. 다시 불러와주세요." : "");
      setLoading(false);
    });
    return () => { alive = false; };
  }, [todayKey, revision]);

  const other: PersonId = me === "yeachan" ? "daeun" : "yeachan";
  const selfName = profiles[0]?.name.trim() || nameOf(me);
  const partnerName = profiles[1]?.name.trim() || nameOf(other);
  const today = parseISO(todayKey);
  const start = parseDay(settings?.date);
  const elapsed = start ? differenceInCalendarDays(today, start) + 1 : null;
  const upcoming = upcomingSpecialDays(today, events, profiles.filter((p): p is Profile => Boolean(p)).map((p) => ({ ...p, name: p.subject === me ? selfName : partnerName })), settings);

  async function openPartner() {
    if (!me || opening) return;
    setOpening(true);
    try { setView([await loadProfile(me, other)]); }
    catch { setError("상대의 소개서를 불러오지 못했어요. 다시 눌러주세요."); }
    finally { setOpening(false); }
  }

  return <main className="mx-auto max-w-md px-5 pb-8 pt-[calc(1.25rem+env(safe-area-inset-top))]">
    <header className="mb-7 flex items-center justify-between">
      <div><p className="text-xs tracking-[0.22em] text-app-muted">둘만의 작은 공간</p><h1 className="mt-1 text-2xl font-bold">우리</h1></div>
      <Link href="/us/settings" aria-label="설정 및 소개서 편집" className="flex h-11 w-11 items-center justify-center rounded-full border border-app-border bg-white text-app-text">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="m9 3-1 3-3 1-2 3 2 2-1 3 3 2 2 3h4l2-3 3-1 1-4-2-2V6l-4-1-2-2Z" /><circle cx="11" cy="11" r="3" /></svg>
      </Link>
    </header>
    {loading ? <p className="py-20 text-center text-app-muted">우리의 오늘을 불러오는 중…</p> : <>
      <section className="relative overflow-hidden rounded-app bg-gradient-to-br from-app-soft via-app-soft to-app-soft px-5 py-9 text-center">
        <span aria-hidden="true" className="absolute -right-5 -top-8 text-[140px] leading-none text-white/50">♡</span>
        <p className="relative text-xs tracking-[0.15em] text-app-muted">너와 나, 그리고 우리의 오늘</p>
        <div className="relative mt-7 flex items-center justify-center gap-4">
          <Avatar profile={profiles[0]} name={selfName} onClick={() => setView([profiles[0]])} />
          <span aria-hidden="true" className="pb-7 text-2xl text-app-accent">♥</span>
          <Avatar profile={profiles[1]} name={partnerName} onClick={() => void openPartner()} disabled={opening} />
        </div>
        <div className="relative mt-7 border-t border-white/70 pt-6">
          <p className="text-sm text-app-muted">{elapsed !== null && elapsed > 0 ? "함께한 지" : "함께 쌓아갈 우리 이야기"}</p>
          <p className="mt-2 text-4xl font-bold tracking-tight text-app-text">{elapsed !== null && elapsed > 0 ? `${elapsed.toLocaleString()}일` : `${selfName} ♥ ${partnerName}`}</p>
          <p className="mt-3 text-xs text-app-muted">{start ? `${format(start, "yyyy.MM.dd")}부터 함께` : "오늘도 서로의 하루에 머물러요"}</p>
        </div>
      </section>
      {!error && (!profiles[1]?.name.trim() || !parseDay(profiles[1]?.birth_date)) && <Link href="/us/settings/profile" className="mt-4 flex items-center justify-between rounded-2xl border border-app-border bg-white p-4 text-sm text-app-text"><span>우리 소개 채우기</span><span>→</span></Link>}
      {!error && !settings?.date && <Link href="/calendar/settings" className="mt-4 block rounded-2xl bg-white p-4 text-sm text-app-text">사귄 날짜 채우기 →</Link>}
      <section className="mt-7"><h2 className="mb-3 text-base font-bold">곧 찾아올 특별한 날</h2>
        <div className="rounded-app bg-white p-5 shadow-sm">
          {upcoming.length ? upcoming.map((event) => <Link href={`/calendar?date=${dateKey(event.date)}`} key={event.id} className="flex items-center justify-between gap-3 border-b border-app-border py-3 first:pt-0 last:border-0 last:pb-0"><div className="min-w-0"><p className="break-words text-sm font-semibold">{event.label}</p><p className="mt-1 text-xs text-app-muted">{format(event.date, "yyyy.MM.dd")}{event.at !== undefined ? ` · ${event.at ? event.at.slice(0, 5) : "종일"}` : ""}</p></div><span className="shrink-0 rounded-full bg-app-soft px-3 py-1.5 text-xs font-semibold text-app-text">{differenceInCalendarDays(event.date, today) === 0 ? "오늘" : `D-${differenceInCalendarDays(event.date, today)}`}</span></Link>) : <p className="text-sm leading-6 text-app-muted">우리만의 특별한 날을 기다려요.<br />기념일과 일정은 캘린더에서 관리할 수 있어요.</p>}
        </div>
      </section>
      <div className="mt-5 grid grid-cols-2 gap-3"><Link href={`/calendar?date=${todayKey}`} className="rounded-app bg-app-soft p-5"><span aria-hidden="true">✎</span><p className="mt-3 text-sm font-semibold">오늘의 우리 기록</p><p className="mt-1 text-xs text-app-muted">사진과 하루를 남겨요 →</p></Link><Link href="/poke" className="rounded-app bg-app-soft p-5"><span aria-hidden="true">♡</span><p className="mt-3 text-sm font-semibold">{partnerName} 생각 중</p><p className="mt-1 text-xs text-app-muted">살짝 찌르러 가기 →</p></Link></div>
      <p className="mt-8 text-center text-xs text-app-muted">평범한 하루도, 함께라서 특별해.</p>
    </>}
    {error && <div role="alert" className="mt-4 text-sm text-[#a45270]">{error}<button onClick={() => setRevision((v) => v + 1)} className="ml-2 underline">다시 불러오기</button></div>}
    {view && <dialog ref={dialog} onCancel={() => setView(null)} onClick={(e) => { if (e.target === e.currentTarget) setView(null); }} className="m-auto max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-app bg-app-background p-0 backdrop:bg-black/30" aria-label="소개서 보기"><section className="mx-auto max-w-md rounded-app bg-app-background p-5"><button onClick={() => setView(null)} className="mb-5 rounded-full bg-white px-4 py-2 text-sm">닫기</button>{view.map((profile, i) => <article key={i} className="mb-4 rounded-2xl bg-white p-5"><h2 className="mb-4 font-bold">{profile?.subject === me ? `${partnerName}가 쓴 나` : `내가 쓴 ${partnerName}`}</h2>{profile ? <><img src={profile.photo_path ? photoUrl(profile.photo_path) : "/default-profile.svg"} alt={`${profile.name} 소개 사진`} className="mb-4 aspect-square w-full rounded-2xl object-cover" /><h3 className="text-xl font-semibold">{profile.name}</h3><p className="mt-1 text-sm text-app-muted">{profile.birth_date}</p><dl className="mt-5 space-y-4">{([['성격', profile.personality], ['좋아하는 것', profile.likes], ['싫어하는 것', profile.dislikes], ['한줄 소개', profile.intro]]).map(([label, value]) => <div key={label}><dt className="text-xs text-app-muted">{label}</dt><dd className="mt-1 whitespace-pre-wrap break-words text-sm">{value || "아직 작성하지 않았어요"}</dd></div>)}</dl></> : <p className="text-sm text-app-muted">아직 작성한 소개서가 없어요.</p>}</article>)}</section></dialog>}
  </main>;
}

function Avatar({ profile, name, onClick, disabled }: { profile: Profile | null | undefined; name: string; onClick: () => void; disabled?: boolean }) {
  return <button onClick={onClick} disabled={disabled} aria-label={`${name} 프로필 보기`} className="relative min-w-0 max-w-[40%] disabled:opacity-50"><div className="mx-auto h-24 w-24 overflow-hidden rounded-full border-4 border-white bg-white/60 shadow-sm"><img src={profile?.photo_path ? photoUrl(profile.photo_path) : "/default-profile.svg"} alt="" className="h-full w-full object-cover" /></div><p className="mt-3 truncate text-sm font-semibold text-app-text">{name}</p></button>;
}
