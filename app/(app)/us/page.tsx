"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { addDays, addYears, differenceInCalendarDays, format, parseISO, startOfDay } from "date-fns";
import { nameOf, readMe, type PersonId } from "@/lib/me";
import { loadProfile, type Profile } from "@/lib/profiles";
import { loadRelationshipDate } from "@/lib/settings";
import { photoUrl } from "@/lib/supabase";

export default function UsPage() {
  const [me, setMe] = useState<PersonId | null>(null);
  const [profiles, setProfiles] = useState<(Profile | null)[]>([]);
  const [settings, setSettings] = useState<Awaited<ReturnType<typeof loadRelationshipDate>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [view, setView] = useState<(Profile | null)[] | null>(null);
  const [opening, setOpening] = useState(false);

  useEffect(() => {
    let alive = true;
    const id = readMe();
    setMe(id);
    if (!id) return;
    const other = id === "yeachan" ? "daeun" : "yeachan";
    // 설정 조회 실패가 저장된 두 사람의 프로필까지 숨기지 않도록 각각 반영한다.
    Promise.allSettled([loadProfile(id, id), loadProfile(id, other), loadRelationshipDate()]).then((results) => {
      if (!alive) return;
      const [self, partner, dates] = results;
      setProfiles([self.status === "fulfilled" ? self.value : null, partner.status === "fulfilled" ? partner.value : null]);
      if (dates.status === "fulfilled") setSettings(dates.value);
      if (results.some((r) => r.status === "rejected")) setError("일부 정보를 불러오지 못했어요. 잠시 후 다시 방문해주세요.");
      setLoading(false);
    });
    return () => { alive = false; };
  }, []);

  const other: PersonId = me === "yeachan" ? "daeun" : "yeachan";
  const selfName = profiles[0]?.name.trim() || nameOf(me);
  const partnerName = profiles[1]?.name.trim() || nameOf(other);
  const today = startOfDay(new Date());
  const start = settings?.date ? parseISO(settings.date) : null;
  const elapsed = start ? differenceInCalendarDays(today, start) + 1 : null;
  const upcoming: { label: string; date: Date }[] = [];
  if (start && settings?.anniversaries) {
    const nextHundred = Math.max(100, Math.ceil((elapsed ?? 1) / 100) * 100);
    upcoming.push({ label: `우리 ${nextHundred}일`, date: addDays(start, nextHundred - 1) });
    let years = Math.max(1, today.getFullYear() - start.getFullYear());
    if (differenceInCalendarDays(addYears(start, years), today) < 0) years++;
    upcoming.push({ label: `우리 ${years}주년`, date: addYears(start, years) });
  }
  if (settings?.birthdays) profiles.forEach((p) => {
    if (!p?.birth_date) return;
    const birthday = parseISO(p.birth_date);
    let date = addYears(birthday, today.getFullYear() - birthday.getFullYear());
    if (differenceInCalendarDays(date, today) < 0) date = addYears(birthday, today.getFullYear() + 1 - birthday.getFullYear());
    upcoming.push({ label: `🎂 ${p.name} 생일`, date });
  });
  upcoming.sort((a, b) => a.date.getTime() - b.date.getTime());

  async function openPartner() {
    if (!me || opening) return;
    setOpening(true);
    try { setView(await Promise.all([loadProfile(other, me), loadProfile(other, other)])); }
    catch { setError("상대의 소개서를 불러오지 못했어요. 다시 눌러주세요."); }
    finally { setOpening(false); }
  }

  return <main className="mx-auto max-w-md px-5 pb-8 pt-[calc(1.25rem+env(safe-area-inset-top))]">
    <header className="mb-7 flex items-center justify-between">
      <div><p className="text-xs tracking-[0.22em] text-[#af798b]">둘만의 작은 공간</p><h1 className="mt-1 text-2xl font-bold">우리</h1></div>
      <Link href="/us/settings" aria-label="설정 및 소개서 편집" className="flex h-11 w-11 items-center justify-center rounded-full border border-[#efdae1] bg-white text-[#976273]">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="m9 3-1 3-3 1-2 3 2 2-1 3 3 2 2 3h4l2-3 3-1 1-4-2-2V6l-4-1-2-2Z" /><circle cx="11" cy="11" r="3" /></svg>
      </Link>
    </header>
    {loading ? <p className="py-20 text-center text-[#af798b]">우리의 오늘을 불러오는 중…</p> : <>
      <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#ffe4ec] via-[#fff0e9] to-[#f7e4ec] px-5 py-9 text-center">
        <span aria-hidden="true" className="absolute -right-5 -top-8 text-[140px] leading-none text-white/50">♡</span>
        <p className="relative text-xs tracking-[0.15em] text-[#a16b7c]">너와 나, 그리고 우리의 오늘</p>
        <div className="relative mt-7 flex items-center justify-center gap-4">
          <Avatar profile={profiles[0]} name={selfName} onClick={() => setView([profiles[0]])} />
          <span aria-hidden="true" className="pb-7 text-2xl text-[#e986a4]">♥</span>
          <Avatar profile={profiles[1]} name={partnerName} onClick={() => void openPartner()} disabled={opening} />
        </div>
        <div className="relative mt-7 border-t border-white/70 pt-6">
          <p className="text-sm text-[#9c6c7b]">{elapsed !== null && elapsed > 0 ? "함께한 지" : "함께 쌓아갈 우리 이야기"}</p>
          <p className="mt-2 text-4xl font-bold tracking-tight text-[#9e4e6b]">{elapsed !== null && elapsed > 0 ? `${elapsed.toLocaleString()}일` : `${selfName} ♥ ${partnerName}`}</p>
          <p className="mt-3 text-xs text-[#a87586]">{start ? `${format(start, "yyyy.MM.dd")}부터 함께` : "오늘도 서로의 하루에 머물러요"}</p>
        </div>
      </section>
      {!error && (!profiles[0]?.photo_path || !profiles[1]?.photo_path || !settings?.date) && <Link href="/us/settings" className="mt-4 flex items-center justify-between rounded-2xl border border-[#efdce3] bg-white p-4 text-sm text-[#9e4e6b]"><span>우리의 소개와 처음 만난 날 채우기</span><span>→</span></Link>}
      <section className="mt-7"><h2 className="mb-3 text-base font-bold">곧 찾아올 특별한 날</h2>
        <div className="rounded-3xl bg-white p-5 shadow-sm">
          {upcoming.length ? upcoming.slice(0, 3).map((event) => <div key={event.label} className="flex items-center justify-between border-b border-[#f7edf1] py-3 first:pt-0 last:border-0 last:pb-0"><div><p className="text-sm font-semibold">{event.label}</p><p className="mt-1 text-xs text-[#b28c99]">{format(event.date, "yyyy.MM.dd")}</p></div><span className="rounded-full bg-[#fff0f5] px-3 py-1.5 text-xs font-semibold text-[#ba6582]">{differenceInCalendarDays(event.date, today) === 0 ? "오늘" : `D-${differenceInCalendarDays(event.date, today)}`}</span></div>) : <p className="text-sm leading-6 text-[#ad8291]">우리만의 특별한 날을 기다려요.<br />기념일은 우상단 설정에서 관리할 수 있어요.</p>}
        </div>
      </section>
      <div className="mt-5 grid grid-cols-2 gap-3"><Link href="/calendar" className="rounded-3xl bg-[#f0eaf5] p-5"><span aria-hidden="true">✎</span><p className="mt-3 text-sm font-semibold">오늘의 우리 기록</p><p className="mt-1 text-xs text-[#9c879e]">사진과 하루를 남겨요 →</p></Link><Link href="/poke" className="rounded-3xl bg-[#fceadf] p-5"><span aria-hidden="true">♡</span><p className="mt-3 text-sm font-semibold">{partnerName} 생각 중</p><p className="mt-1 text-xs text-[#a88979]">살짝 찌르러 가기 →</p></Link></div>
      <p className="mt-8 text-center text-xs text-[#bd99a6]">평범한 하루도, 함께라서 특별해.</p>
    </>}
    {error && <p role="alert" className="mt-4 text-sm text-[#a45270]">{error}</p>}
    {view && <div className="fixed inset-0 z-50 overflow-y-auto bg-black/30 p-5" role="dialog" aria-modal="true" aria-label="소개서 보기"><section className="mx-auto my-8 max-w-md rounded-3xl bg-[#fff7f9] p-5"><button onClick={() => setView(null)} className="mb-5 rounded-full bg-white px-4 py-2 text-sm">닫기</button>{view.map((profile, i) => <article key={i} className="mb-4 rounded-2xl bg-white p-5"><h2 className="mb-4 font-bold">{view.length === 1 ? "내 소개" : i === 0 ? `${partnerName}가 쓴 나` : `${partnerName}가 쓴 본인 소개`}</h2>{profile ? <>{profile.photo_path && <img src={photoUrl(profile.photo_path)} alt={`${profile.name} 소개 사진`} className="mb-4 aspect-square w-full rounded-2xl object-cover" />}<h3 className="text-xl font-semibold">{profile.name}</h3><p className="mt-1 text-sm text-[#ab8191]">{profile.birth_date}</p><dl className="mt-5 space-y-4">{([['성격', profile.personality], ['좋아하는 것', profile.likes], ['싫어하는 것', profile.dislikes], ['한줄 소개', profile.intro]]).map(([label, value]) => <div key={label}><dt className="text-xs text-[#b18595]">{label}</dt><dd className="mt-1 whitespace-pre-wrap break-words text-sm">{value || "아직 작성하지 않았어요"}</dd></div>)}</dl></> : <p className="text-sm text-[#ab8191]">아직 작성한 소개서가 없어요.</p>}</article>)}</section></div>}
  </main>;
}

function Avatar({ profile, name, onClick, disabled }: { profile: Profile | null | undefined; name: string; onClick: () => void; disabled?: boolean }) {
  return <button onClick={onClick} disabled={disabled} aria-label={`${name} 프로필 보기`} className="relative min-w-0 max-w-[40%] disabled:opacity-50"><div className="mx-auto h-24 w-24 overflow-hidden rounded-full border-4 border-white bg-white/60 shadow-sm">{profile?.photo_path ? <img src={photoUrl(profile.photo_path)} alt="" className="h-full w-full object-cover" /> : <span className="flex h-full items-center justify-center text-3xl text-[#d99bb1]">♡</span>}</div><p className="mt-3 truncate text-sm font-semibold text-[#805666]">{name}</p></button>;
}
