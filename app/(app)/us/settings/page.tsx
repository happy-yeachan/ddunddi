"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PEOPLE, readMe, type PersonId } from "@/lib/me";
import { parseDay } from "@/lib/calendar-dates";
import { loadProfile, saveProfile, uploadProfilePhoto, type Profile } from "@/lib/profiles";
import { photoUrl } from "@/lib/supabase";

type Form = Omit<Profile, "id" | "author" | "subject">;
const EMPTY: Form = { photo_path: null, name: "", birth_date: "", personality: "", likes: "", dislikes: "", intro: "" };
const copyForm = (p: Profile | null): Form => p ? { photo_path: p.photo_path, name: p.name, birth_date: p.birth_date ?? "", personality: p.personality, likes: p.likes, dislikes: p.dislikes, intro: p.intro } : { ...EMPTY };
const complete = (p: Form) => Boolean(p.name.trim() && parseDay(p.birth_date));

export default function UsPage() {
  const router = useRouter();
  const [me, setMe] = useState<PersonId | null>(null);
  const [subject, setSubject] = useState<PersonId | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [photoName, setPhotoName] = useState("");
  const [loadFailed, setLoadFailed] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => setMe(readMe()), []);
  useEffect(() => {
    if (!me) return;
    const other = PEOPLE.find((p) => p.id !== me)?.id ?? me;
    setSubject((current) => current ?? other);
  }, [me]);
  useEffect(() => {
    if (!me || !subject) return;
    let alive = true;
    setLoading(true);
    setLoadFailed(false); setMessage("");
    loadProfile(me, subject).then((p) => { if (alive) setForm(copyForm(p)); }).catch(() => { if (alive) { setLoadFailed(true); setMessage("소개서를 불러오지 못했어요"); } }).finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [me, subject, retry]);

  function change(key: keyof Form, value: string | null) { setForm((current) => ({ ...current, [key]: value })); }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!me || !subject || loading || saving || uploading || loadFailed) return;
    setSaving(true); setMessage("");
    if (!complete(form)) {
      window.alert("이름과 올바른 생년월일을 입력해주세요.");
      setSaving(false);
      return;
    }
    try {
      await saveProfile({ ...form, author: me, subject });
      router.replace("/us");
      setMessage("소개서를 저장했어요");
    }
    catch { setMessage("저장하지 못했어요. 잠시 후 다시 시도해주세요"); }
    finally { setSaving(false); }
  }
  async function photo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !me || !subject || uploading || saving) return;
    setUploading(true); setMessage("사진을 업로드하는 중이에요…");
    try { change("photo_path", await uploadProfilePhoto(me, subject, file)); setPhotoName(file.name); setMessage("사진을 추가했어요. 저장을 눌러 완료해주세요"); }
    catch { setMessage("사진을 업로드하지 못했어요"); }
    finally { setUploading(false); }
  }


  return <main className="mx-auto max-w-md px-6 pt-[calc(2rem+env(safe-area-inset-top))] pb-8">
    <Link href="/us" className="mb-5 inline-block text-sm text-[#a45d73]">← 우리 홈으로</Link>
    <h1 className="mb-2 text-2xl font-bold">설정 · 소개서 편집</h1>
    <p className="mb-6 text-sm text-[#bda5ae]">두 사람의 소개를 관리해요</p>
    <Link href="/calendar/settings" className="mb-5 inline-block text-sm text-[#a45d73]">사귄 날짜 · 기념일은 캘린더 설정에서 →</Link>
    {message && <p role="status" className="mb-4 text-sm text-[#a45270]">{message}</p>}
    {loadFailed && <button onClick={() => setRetry((v) => v + 1)} className="mb-4 text-sm underline">다시 불러오기</button>}
    <h2 className="mb-5 text-lg font-semibold">내가 쓰는 상대</h2>
    {loading ? <p className="py-10">불러오는 중…</p> : <form onSubmit={submit} className="space-y-4">
      <fieldset disabled={saving || uploading || loadFailed} className="space-y-4 disabled:opacity-60">
      <div>
        <p className="mb-2 text-sm font-semibold">사진 <span className="font-normal text-[#ab8191]">(선택)</span></p>
        <div className="flex items-center gap-4 rounded-2xl bg-white p-4">
          <img src={form.photo_path ? photoUrl(form.photo_path) : "/default-profile.svg"} alt={form.photo_path ? "소개서 사진" : "하트를 안은 기본 프로필 캐릭터"} className="h-24 w-24 shrink-0 rounded-2xl object-cover" />
          <div className="min-w-0">
            <label className="relative inline-flex cursor-pointer rounded-full bg-[#fff0f5] px-4 py-2 text-sm font-semibold text-[#a45d73] focus-within:ring-2 focus-within:ring-[#ff8fab]">
              {uploading ? "업로드 중…" : "사진 선택"}
              <input type="file" accept="image/*" aria-label="소개서 사진 선택" aria-describedby="profile-photo-status" onChange={photo} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
            </label>
            <p id="profile-photo-status" className="mt-2 break-all text-xs text-[#ab8191]">{uploading ? "사진을 올리고 있어요" : photoName || (form.photo_path ? "저장된 사진을 사용 중이에요" : "기본 이미지를 사용해요")}</p>
            {form.photo_path && <button type="button" onClick={() => { change("photo_path", null); setPhotoName(""); setMessage("기본 이미지로 바꿨어요. 저장을 눌러 완료해주세요"); }} className="mt-2 text-xs text-[#a45d73] underline">기본 이미지로 변경</button>}
          </div>
        </div>
        <p className="mt-2 text-xs text-[#ab8191]">사진을 올리지 않아도 기본 이미지로 저장할 수 있어요.</p>
      </div>
      <Field label="이름" value={form.name} onChange={(v) => change("name", v)} placeholder="이름을 적어주세요" />
      <label className="block"><span className="mb-2 block text-sm font-semibold">생년월일</span><input type="text" inputMode="numeric" pattern="\d{4}-\d{2}-\d{2}" placeholder="YYYY-MM-DD" value={form.birth_date} onChange={(e) => change("birth_date", formatDateInput(e.target.value))} className="w-full rounded-2xl border border-[#f5d0da] bg-white px-4 py-3 outline-none placeholder:text-[#d8b6c0] focus:border-[#ff8fab]" /></label>
      <Field label="성격" value={form.personality} onChange={(v) => change("personality", v)} placeholder="어떤 사람인가요?" area />
      <Field label="좋아하는 것" value={form.likes} onChange={(v) => change("likes", v)} placeholder="좋아하는 것을 적어주세요" area />
      <Field label="싫어하는 것" value={form.dislikes} onChange={(v) => change("dislikes", v)} placeholder="싫어하는 것을 적어주세요" area />
      <Field label="한줄 소개" value={form.intro} onChange={(v) => change("intro", v)} placeholder="한 문장으로 소개해주세요" />
      <button disabled={saving || uploading || loadFailed} className="w-full rounded-2xl bg-[#ff8fab] py-4 text-lg font-semibold text-white disabled:opacity-50">{uploading ? "사진 업로드 중…" : saving ? "저장 중…" : "소개서 저장"}</button>
      </fieldset>
      {message && <p className="text-center text-sm text-[#e05c7e]">{message}</p>}
    </form>}
  </main>;
}

function formatDateInput(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  return [digits.slice(0, 4), digits.slice(4, 6), digits.slice(6, 8)].filter(Boolean).join("-");
}

function Field({ label, value, onChange, placeholder, area }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; area?: boolean }) {
  return <label className="block"><span className="mb-2 block text-sm font-semibold">{label}</span>{area ? <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={3} className="w-full resize-none rounded-2xl border border-[#f5d0da] bg-white px-4 py-3 outline-none placeholder:text-[#d8b6c0] focus:border-[#ff8fab]" /> : <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full rounded-2xl border border-[#f5d0da] bg-white px-4 py-3 outline-none placeholder:text-[#d8b6c0] focus:border-[#ff8fab]" />}</label>;
}
