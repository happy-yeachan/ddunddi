"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { photoUrl } from "@/lib/supabase";
import { PEOPLE, nameOf, type PersonId } from "@/lib/me";
import { loadProfile } from "@/lib/profiles";
import {
  deleteNote,
  deletePhoto,
  ensureDate,
  loadDate,
  resizeImage,
  upsertNote,
  uploadPhoto,
  type Note,
  type Photo,
} from "@/lib/records";

type Props = {
  dateKey: string;
  label: string;
  me: PersonId;
  onClose: () => void;
  onSaved: () => void;
};

type Progress = { done: number; total: number } | null;

export default function DateSheet({ dateKey, label, me, onClose, onSaved }: Props) {
  const fileInput = useRef<HTMLInputElement>(null);
  const partner = PEOPLE.find((p) => p.id !== me)!.id;

  const [loading, setLoading] = useState(true);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);

  // 저장을 누르기 전까지는 화면에서만 바뀐다. 버튼 하나가 모든 변경을 책임진다.
  const [draft, setDraft] = useState("");
  const [saved, setSaved] = useState("");
  const [doomed, setDoomed] = useState<string[]>([]);
  const [picked, setPicked] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [unpreviewable, setUnpreviewable] = useState<number[]>([]);

  const [partnerLabel, setPartnerLabel] = useState(nameOf(partner));
  const [progress, setProgress] = useState<Progress>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    loadDate(dateKey)
      .then(({ photos, notes }) => {
        if (!alive) return;
        setPhotos(photos);
        setNotes(notes);
        const mine = notes.find((n) => n.author === me)?.body ?? "";
        setDraft(mine);
        setSaved(mine);
      })
      .catch((e) => alive && setError(e.message ?? "불러오지 못했어요"))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [dateKey, me]);

  // 상대 이름은 내가 쓴 소개서의 이름을 우선한다.
  useEffect(() => {
    let alive = true;
    loadProfile(me, partner)
      .then((p) => {
        if (alive && p?.name.trim()) setPartnerLabel(p.name.trim());
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [me, partner]);

  // objectURL 은 직접 해제하지 않으면 메모리에 남는다.
  useEffect(() => {
    const urls = picked.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    setUnpreviewable([]);
    return () => urls.forEach(URL.revokeObjectURL);
  }, [picked]);

  const partnerNote = notes.find((n) => n.author === partner);
  const dirty = useMemo(
    () => draft !== saved || picked.length > 0 || doomed.length > 0,
    [draft, saved, picked.length, doomed.length]
  );

  async function save() {
    if (saving || !dirty) return;
    setSaving(true);
    setError("");

    try {
      const dateId = await ensureDate(dateKey);

      // 지우기부터. 올리기 전에 치워야 사진 순서가 꼬이지 않는다.
      for (const id of doomed) {
        const photo = photos.find((p) => p.id === id);
        if (photo) await deletePhoto(photo);
      }

      if (picked.length > 0) {
        setProgress({ done: 0, total: picked.length });
        // 한 장씩 올린다. 동시에 올리면 진행 표시가 의미를 잃고
        // 모바일 회선에서 오히려 느려진다.
        const base = photos.length - doomed.length;
        for (const [i, file] of picked.entries()) {
          try {
            const blob = await resizeImage(file);
            await uploadPhoto(dateKey, dateId, blob, base + i);
          } catch (e) {
            const why = e instanceof Error ? e.message : "알 수 없는 오류";
            throw new Error(`${i + 1}번째 사진에서 멈췄어요 — ${why}`);
          }
          setProgress({ done: i + 1, total: picked.length });
        }
      }

      const text = draft.trim();
      const mine = notes.find((n) => n.author === me);
      if (text) {
        await upsertNote(dateId, me, text);
      } else if (mine) {
        // 일기를 비우고 저장하면 지운다는 뜻이다.
        await deleteNote(mine.id);
      }

      const fresh = await loadDate(dateKey);
      setPhotos(fresh.photos);
      setNotes(fresh.notes);
      setSaved(text);
      setDraft(text);
      setPicked([]);
      setDoomed([]);
      setProgress(null);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장에 실패했어요");
      setProgress(null);
    } finally {
      setSaving(false);
    }
  }

  function close() {
    if (dirty && !confirm("저장하지 않은 변경이 있어요. 닫을까요?")) return;
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end" role="dialog" aria-modal="true">
      <button aria-label="닫기" onClick={close} className="absolute inset-0 bg-black/30" />

      <section className="relative mx-auto flex max-h-[88dvh] w-full max-w-md flex-col rounded-t-3xl bg-[#fff7f9] pb-[env(safe-area-inset-bottom)]">
        <div className="flex justify-center pb-2 pt-3">
          <div className="h-1 w-10 rounded-full bg-[#eccfd8]" />
        </div>

        <header className="px-5 pb-3">
          <h2 className="text-lg font-bold">{label}</h2>
        </header>

        <div className="flex-1 overflow-y-auto px-5">
          {loading ? (
            <p className="py-10 text-center text-sm text-[#bda5ae]">불러오는 중…</p>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2">
                {photos.map((p) => {
                  const marked = doomed.includes(p.id);
                  return (
                    <div key={p.id} className="relative">
                      {/* 업로드 전에 이미 1600px 로 줄여 올리므로 next/image 의
                          최적화 이득이 작고, Vercel 할당량도 쓰지 않는다. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photoUrl(p.path)}
                        alt=""
                        loading="lazy"
                        className={`aspect-square w-full rounded-xl object-cover transition ${
                          marked ? "opacity-25" : ""
                        }`}
                      />
                      <button
                        onClick={() =>
                          setDoomed((prev) =>
                            marked ? prev.filter((id) => id !== p.id) : [...prev, p.id]
                          )
                        }
                        aria-label={marked ? "되돌리기" : "지울 사진으로 표시"}
                        className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-sm text-white transition active:scale-90"
                      >
                        {marked ? "↩" : "×"}
                      </button>
                      {marked && (
                        <span className="pointer-events-none absolute inset-x-0 bottom-2 text-center text-[10px] font-medium text-[#c94a6c]">
                          저장하면 삭제
                        </span>
                      )}
                    </div>
                  );
                })}

                {picked.map((f, i) => (
                  <div key={`${f.name}-${i}`} className="relative">
                    {previews[i] && !unpreviewable.includes(i) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={previews[i]}
                        alt=""
                        className="aspect-square w-full rounded-xl border border-dashed border-[#f0cdd8] object-cover"
                        onError={() =>
                          setUnpreviewable((prev) => (prev.includes(i) ? prev : [...prev, i]))
                        }
                      />
                    ) : (
                      <div className="flex aspect-square w-full items-center justify-center rounded-xl border border-dashed border-[#f0cdd8] text-[10px] text-[#bda5ae]">
                        올릴 사진
                      </div>
                    )}
                    <button
                      onClick={() => setPicked((prev) => prev.filter((_, j) => j !== i))}
                      aria-label="선택 취소"
                      className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-black/40 text-sm text-white transition active:scale-90"
                    >
                      ×
                    </button>
                  </div>
                ))}

                <button
                  onClick={() => fileInput.current?.click()}
                  aria-label="사진 추가"
                  className="flex aspect-square w-full items-center justify-center rounded-xl border border-[#f0cdd8] bg-white text-2xl text-[#d8b6c0] transition active:scale-95"
                >
                  +
                </button>
              </div>

              <input
                ref={fileInput}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  // files 를 먼저 꺼내둔다. setPicked 에 넘기는 함수는 나중에
                  // 실행되는데, 그 전에 value 를 비우면 files 도 같이 비워진다.
                  const files = Array.from(e.target.files ?? []);
                  e.target.value = "";
                  setPicked((prev) => [...prev, ...files]);
                }}
              />

              <section className="mt-5">
                <h3 className="mb-1.5 text-xs font-medium text-[#bda5ae]">내 일기</h3>
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="오늘 어땠어?"
                  rows={5}
                  className="w-full resize-none rounded-2xl border border-[#f5d0da] bg-white px-4 py-3 leading-relaxed outline-none placeholder:text-[#d8b6c0] focus:border-[#ff8fab]"
                />
              </section>

              <section className="mt-4 mb-2">
                <h3 className="mb-1.5 text-xs font-medium text-[#bda5ae]">
                  {partnerLabel}의 일기
                </h3>
                {partnerNote ? (
                  <div className="whitespace-pre-wrap rounded-2xl border border-[#f5d0da] bg-white px-4 py-3 text-sm leading-relaxed">
                    {partnerNote.body}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-[#f0cdd8] px-4 py-6 text-center text-sm text-[#d8b6c0]">
                    아직 안 썼어요
                  </div>
                )}
              </section>
            </>
          )}
        </div>

        <div className="px-5 pb-4 pt-3">
          {error && (
            <p className="mb-2 rounded-xl bg-[#ffe8ee] px-3 py-2 text-sm text-[#c94a6c]">
              {error}
            </p>
          )}

          {progress && (
            <div className="mb-2">
              <div className="mb-1 flex justify-between text-xs text-[#bda5ae]">
                <span>사진 올리는 중</span>
                <span>
                  {progress.done} / {progress.total}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-[#f5e2e8]">
                <div
                  className="h-full rounded-full bg-[#ff8fab] transition-[width]"
                  style={{ width: `${(progress.done / progress.total) * 100}%` }}
                />
              </div>
            </div>
          )}

          <button
            onClick={save}
            disabled={saving || loading || !dirty}
            className="w-full rounded-2xl bg-[#ff8fab] py-4 text-lg font-semibold text-white transition active:scale-[0.98] disabled:opacity-40"
          >
            {saving ? "저장 중…" : summarize(picked.length, doomed.length, draft !== saved)}
          </button>
        </div>
      </section>
    </div>
  );
}

// 저장 버튼이 무엇을 반영할지 미리 보여준다. 조용히 실패하거나
// 눌러도 아무 일 없어 보이는 상황을 막는다.
function summarize(adding: number, removing: number, edited: boolean) {
  const parts = [];
  if (adding) parts.push(`사진 ${adding}장`);
  if (removing) parts.push(`삭제 ${removing}장`);
  if (edited) parts.push("일기");
  return parts.length > 0 ? `저장 · ${parts.join(" · ")}` : "저장";
}
