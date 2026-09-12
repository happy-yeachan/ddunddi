"use client";

import { useEffect, useState } from "react";
import { nameOf, PEOPLE, readMe, type PersonId } from "@/lib/me";
import { loadProfile, saveProfile, uploadProfilePhoto, type Profile } from "@/lib/profiles";
import { photoUrl } from "@/lib/supabase";

type Form = Omit<Profile, "id" | "author" | "subject">;
const EMPTY: Form = { photo_path: null, name: "", birth_date: "", personality: "", likes: "", dislikes: "", intro: "" };

export default function UsPage() {
  const [me, setMe] = useState<PersonId | null>(null);
  const [subject, setSubject] = useState<PersonId | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => setMe(readMe()), []);
  useEffect(() => {
    if (!me) return;
    const other = PEOPLE.find((p) => p.id !== me)?.id ?? me;
    setSubject((current) => current ?? other);
  }, [me]);
  useEffect(() => {
    if (!me || !subject) return;
    setLoading(true);
    loadProfile(me, subject).then((p) => setForm(p ? { photo_path: p.photo_path, name: p.name, birth_date: p.birth_date, personality: p.personality, likes: p.likes, dislikes: p.dislikes, intro: p.intro } : EMPTY)).catch(() => setMessage("소개서를 불러오지 못했어요")).finally(() => setLoading(false));
  }, [me, subject]);

  function change(key: keyof Form, value: string | null) { setForm((current) => ({ ...current, [key]: value })); }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!me || !subject) return;
    setSaving(true); setMessage("");
    try { await saveProfile({ ...form, author: me, subject }); setMessage("소개서를 저장했어요"); }
    catch { setMessage("저장하지 못했어요. 잠시 후 다시 시도해주세요"); }
    finally { setSaving(false); }
  }
  async function photo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file || !me || !subject) return;
    try { change("photo_path", await uploadProfilePhoto(me, subject, file)); setMessage("사진을 추가했어요. 저장을 눌러 완료해주세요"); }
    catch { setMessage("사진을 업로드하지 못했어요"); }
  }

  return <main className="mx-auto max-w-md px-6 pt-[calc(2rem+env(safe-area-inset-top))] pb-8">
    <h1 className="mb-2 text-2xl font-bold">우리 소개서</h1>
    <p className="mb-6 text-sm text-[#bda5ae]">서로를 바라보는 마음으로 한 장씩 채워요</p>
    <div className="mb-6 grid grid-cols-2 gap-2 rounded-2xl bg-[#ffeef2] p-1">
      {me && PEOPLE.map((p) => <button key={p.id} onClick={() => setSubject(p.id)} className={`rounded-xl py-3 text-sm font-semibold ${subject === p.id ? "bg-white text-[#ff7092] shadow-sm" : "text-[#c5a8b2]"}`}>{p.id === me ? "내가 쓰는 나" : `내가 쓰는 ${nameOf(p.id)}`}</button>)}
    </div>
    {loading ? <div className="py-16 text-center text-sm text-[#c5a8b2]">불러오는 중…</div> : <form onSubmit={submit} className="space-y-4">
      <label className="block"><span className="mb-2 block text-sm font-semibold">사진</span><input type="file" accept="image/*" onChange={photo} className="w-full text-sm" />{form.photo_path && <img src={photoUrl(form.photo_path)} alt="소개서 사진" className="mt-3 h-32 w-32 rounded-2xl object-cover" />}</label>
      <Field label="이름" value={form.name} onChange={(v) => change("name", v)} placeholder="이름을 적어주세요" />
      <label className="block"><span className="mb-2 block text-sm font-semibold">생년월일</span><input type="date" value={form.birth_date} onChange={(e) => change("birth_date", e.target.value)} className="w-full rounded-2xl border border-[#f5d0da] bg-white px-4 py-3 outline-none focus:border-[#ff8fab]" /></label>
      <Field label="성격" value={form.personality} onChange={(v) => change("personality", v)} placeholder="어떤 사람인가요?" area />
      <Field label="좋아하는 것" value={form.likes} onChange={(v) => change("likes", v)} placeholder="좋아하는 것을 적어주세요" area />
      <Field label="싫어하는 것" value={form.dislikes} onChange={(v) => change("dislikes", v)} placeholder="싫어하는 것을 적어주세요" area />
      <Field label="한줄 소개" value={form.intro} onChange={(v) => change("intro", v)} placeholder="한 문장으로 소개해주세요" />
      <button disabled={saving} className="w-full rounded-2xl bg-[#ff8fab] py-4 text-lg font-semibold text-white disabled:opacity-50">{saving ? "저장 중…" : "소개서 저장"}</button>
      {message && <p className="text-center text-sm text-[#e05c7e]">{message}</p>}
    </form>}
  </main>;
}

function Field({ label, value, onChange, placeholder, area }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; area?: boolean }) {
  return <label className="block"><span className="mb-2 block text-sm font-semibold">{label}</span>{area ? <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={3} className="w-full resize-none rounded-2xl border border-[#f5d0da] bg-white px-4 py-3 outline-none placeholder:text-[#d8b6c0] focus:border-[#ff8fab]" /> : <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full rounded-2xl border border-[#f5d0da] bg-white px-4 py-3 outline-none placeholder:text-[#d8b6c0] focus:border-[#ff8fab]" />}</label>;
}
