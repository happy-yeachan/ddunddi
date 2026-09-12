"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { nameOf, PEOPLE, readMe, type PersonId } from "@/lib/me";
import { loadProfile, saveProfile, uploadProfilePhoto, type Profile } from "@/lib/profiles";
import { photoUrl } from "@/lib/supabase";
import { loadRelationshipDate, saveRelationshipDate } from "@/lib/settings";

type Form = Omit<Profile, "id" | "author" | "subject">;
const EMPTY: Form = { photo_path: null, name: "", birth_date: "", personality: "", likes: "", dislikes: "", intro: "" };
const copyForm = (p: Profile | null): Form => p ? { photo_path: p.photo_path, name: p.name, birth_date: p.birth_date ?? "", personality: p.personality, likes: p.likes, dislikes: p.dislikes, intro: p.intro } : { ...EMPTY };
const complete = (p: Form) => Boolean(p.photo_path && p.name.trim() && /^\d{4}-\d{2}-\d{2}$/.test(p.birth_date));

export default function UsPage() {
  const router = useRouter();
  const [me, setMe] = useState<PersonId | null>(null);
  const [subject, setSubject] = useState<PersonId | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [relationshipDate, setRelationshipDate] = useState("");
  const [dashboardProfiles, setDashboardProfiles] = useState<Profile[]>([]);
  const [editing, setEditing] = useState(true);
  const [showAnniversaries, setShowAnniversaries] = useState(true);
  const [showBirthdays, setShowBirthdays] = useState(true);

  useEffect(() => setMe(readMe()), []);
  useEffect(() => {
    if (!me) return;
    const other = PEOPLE.find((p) => p.id !== me)!.id;
    Promise.all([loadProfile(me, me), loadProfile(me, other), loadRelationshipDate()]).then(([self, partner, date]) => {
      setDashboardProfiles([self, partner].filter(Boolean) as Profile[]);
      setRelationshipDate(date?.date ?? ""); setShowAnniversaries(date?.anniversaries ?? true); setShowBirthdays(date?.birthdays ?? true);
    }).catch(() => {});
  }, [me]);
  useEffect(() => {
    if (!me) return;
    const other = PEOPLE.find((p) => p.id !== me)?.id ?? me;
    setSubject((current) => current ?? other);
  }, [me]);
  useEffect(() => {
    if (!me || !subject) return;
    let alive = true;
    setLoading(true);
    loadProfile(me, subject).then((p) => { if (alive) setForm(copyForm(p)); }).catch(() => alive && setMessage("소개서를 불러오지 못했어요")).finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [me, subject]);

  function change(key: keyof Form, value: string | null) { setForm((current) => ({ ...current, [key]: value })); }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!me || !subject) return;
    setSaving(true); setMessage("");
    if (!complete(form)) {
      window.alert(`${subject === me ? "내가 쓰는 나" : `내가 쓰는 ${nameOf(subject)}`} 소개서에 사진, 이름, 생년월일을 모두 입력해주세요.`);
      setSaving(false);
      return;
    }
    try {
      await saveProfile({ ...form, author: me, subject });
      const other = PEOPLE.find((p) => p.id !== me)!.id;
      const next = subject === me ? other : me;
      const nextProfile = await loadProfile(me, next);
      if (!nextProfile || !complete(copyForm(nextProfile))) {
        window.alert(`내가 쓰는 ${next === me ? "나" : nameOf(next)}를 작성해주세요`);
        setSubject(next);
        return;
      }
      router.replace("/us");
      setMessage("소개서를 저장했어요");
    }
    catch { setMessage("저장하지 못했어요. 잠시 후 다시 시도해주세요"); }
    finally { setSaving(false); }
  }
  async function photo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file || !me || !subject) return;
    try { change("photo_path", await uploadProfilePhoto(me, subject, file)); setMessage("사진을 추가했어요. 저장을 눌러 완료해주세요"); }
    catch { setMessage("사진을 업로드하지 못했어요"); }
  }

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    try { await saveRelationshipDate(relationshipDate, showAnniversaries, showBirthdays); router.push("/us"); }
    catch { setMessage("설정을 저장하지 못했어요"); }
  }

  return <main className="mx-auto max-w-md px-6 pt-[calc(2rem+env(safe-area-inset-top))] pb-8">
    <Link href="/us" className="mb-5 inline-block text-sm text-[#a45d73]">← 우리 홈으로</Link>
    <h1 className="mb-2 text-2xl font-bold">설정 · 소개서 편집</h1>
    <p className="mb-6 text-sm text-[#bda5ae]">두 사람의 소개와 기념일을 관리해요</p>
    {message && <p role="status" className="mb-4 text-sm text-[#a45270]">{message}</p>}
    <section className="mb-6 grid grid-cols-2 gap-3">{dashboardProfiles.map((p) => <button key={`${p.author}-${p.subject}`} onClick={() => { setSubject(p.subject); setEditing(true); }} className="rounded-2xl bg-white p-4 text-left shadow-sm"><div className="mb-3 h-20 w-20 overflow-hidden rounded-2xl bg-[#ffe0e8]">{p.photo_path && <img src={photoUrl(p.photo_path)} alt="" className="h-full w-full object-cover" />}</div><p className="font-semibold">{p.name || nameOf(p.subject)}</p><p className="mt-1 text-xs text-[#bda5ae]">{p.subject === me ? "내 소개" : "상대 소개"}</p></button>)}</section>
    {dashboardProfiles.length === 2 && !editing ? <button onClick={() => setEditing(true)} className="mb-6 w-full rounded-2xl bg-[#ffe0e8] py-3 text-sm font-semibold text-[#e05c7e]">소개서와 설정 수정</button> : null}
    {(editing || dashboardProfiles.length < 2) && <form onSubmit={saveSettings} className="mb-8 rounded-2xl bg-white p-4"><h2 className="mb-3 font-semibold">우리 설정</h2><label className="block text-sm"><span className="mb-2 block text-[#bda5ae]">사귄 날짜</span><input type="text" inputMode="numeric" pattern="\d{4}-\d{2}-\d{2}" placeholder="YYYY-MM-DD" value={relationshipDate} onChange={(e) => setRelationshipDate(formatDateInput(e.target.value))} className="w-full rounded-xl border border-[#f5d0da] px-3 py-2 outline-none focus:border-[#ff8fab]" /></label><label className="mt-3 flex items-center justify-between text-sm"><span>기념일 표시</span><input type="checkbox" checked={showAnniversaries} onChange={(e) => setShowAnniversaries(e.target.checked)} /></label><label className="mt-3 flex items-center justify-between text-sm"><span>생일 표시</span><input type="checkbox" checked={showBirthdays} onChange={(e) => setShowBirthdays(e.target.checked)} /></label><button className="mt-3 rounded-xl bg-[#ffe0e8] px-4 py-2 text-sm font-semibold text-[#e05c7e]">설정 저장</button></form>}
    {(editing || dashboardProfiles.length < 2) && <h2 className="mb-2 text-lg font-bold">소개서 수정</h2>}
    <div className="mb-6 grid grid-cols-2 gap-2 rounded-2xl bg-[#ffeef2] p-1">
      {me && PEOPLE.map((p) => <button key={p.id} onClick={() => setSubject(p.id)} className={`rounded-xl py-3 text-sm font-semibold ${subject === p.id ? "bg-white text-[#ff7092] shadow-sm" : "text-[#c5a8b2]"}`}>{p.id === me ? "내가 쓰는 나" : `내가 쓰는 ${nameOf(p.id)}`}</button>)}
    </div>
    {(editing || dashboardProfiles.length < 2) && (loading ? <div className="py-16 text-center text-sm text-[#c5a8b2]">불러오는 중…</div> : <form onSubmit={submit} className="space-y-4">
      <label className="block"><span className="mb-2 block text-sm font-semibold">사진</span><input type="file" accept="image/*" onChange={photo} className="w-full text-sm" />{form.photo_path && <img src={photoUrl(form.photo_path)} alt="소개서 사진" className="mt-3 h-32 w-32 rounded-2xl object-cover" />}</label>
      <Field label="이름" value={form.name} onChange={(v) => change("name", v)} placeholder="이름을 적어주세요" />
      <label className="block"><span className="mb-2 block text-sm font-semibold">생년월일</span><input type="text" inputMode="numeric" pattern="\d{4}-\d{2}-\d{2}" placeholder="YYYY-MM-DD" value={form.birth_date} onChange={(e) => change("birth_date", formatDateInput(e.target.value))} className="w-full rounded-2xl border border-[#f5d0da] bg-white px-4 py-3 outline-none placeholder:text-[#d8b6c0] focus:border-[#ff8fab]" /></label>
      <Field label="성격" value={form.personality} onChange={(v) => change("personality", v)} placeholder="어떤 사람인가요?" area />
      <Field label="좋아하는 것" value={form.likes} onChange={(v) => change("likes", v)} placeholder="좋아하는 것을 적어주세요" area />
      <Field label="싫어하는 것" value={form.dislikes} onChange={(v) => change("dislikes", v)} placeholder="싫어하는 것을 적어주세요" area />
      <Field label="한줄 소개" value={form.intro} onChange={(v) => change("intro", v)} placeholder="한 문장으로 소개해주세요" />
      <button disabled={saving} className="w-full rounded-2xl bg-[#ff8fab] py-4 text-lg font-semibold text-white disabled:opacity-50">{saving ? "저장 중…" : "소개서 저장"}</button>
      {message && <p className="text-center text-sm text-[#e05c7e]">{message}</p>}
    </form>)}
  </main>;
}

function formatDateInput(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  return [digits.slice(0, 4), digits.slice(4, 6), digits.slice(6, 8)].filter(Boolean).join("-");
}

function Field({ label, value, onChange, placeholder, area }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; area?: boolean }) {
  return <label className="block"><span className="mb-2 block text-sm font-semibold">{label}</span>{area ? <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={3} className="w-full resize-none rounded-2xl border border-[#f5d0da] bg-white px-4 py-3 outline-none placeholder:text-[#d8b6c0] focus:border-[#ff8fab]" /> : <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full rounded-2xl border border-[#f5d0da] bg-white px-4 py-3 outline-none placeholder:text-[#d8b6c0] focus:border-[#ff8fab]" />}</label>;
}
