"use client";

import { useEffect, useRef, useState } from "react";
import { photoUrl } from "@/lib/supabase";
import { nameOf, type PersonId } from "@/lib/me";
import { loadProfile } from "@/lib/profiles";
import {
  deletePhoto,
  loadDate,
  resizeImage,
  saveMemo,
  uploadPhoto,
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

  const [loading, setLoading] = useState(true);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [memo, setMemo] = useState("");
  const [author, setAuthor] = useState<string | null>(null);
  const [authorLabel, setAuthorLabel] = useState<string | null>(null);

  const [picked, setPicked] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  // 브라우저가 못 그리는 형식(HEIC 등)의 인덱스
  const [unpreviewable, setUnpreviewable] = useState<number[]>([]);
  const [progress, setProgress] = useState<Progress>(null);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    loadDate(dateKey)
      .then(({ record, photos }) => {
        if (!alive) return;
        setMemo(record?.body ?? "");
        setAuthor(record?.author ?? null);
        setPhotos(photos);
      })
      .catch((e) => alive && setError(e.message ?? "불러오지 못했어요"))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [dateKey]);

  useEffect(() => {
    if (!author) {
      setAuthorLabel(null);
      return;
    }
    const id = author as PersonId;
    setAuthorLabel(nameOf(id));
    if (id === me) return;
    let alive = true;
    loadProfile(me, id).then((profile) => {
      if (alive && profile?.name.trim()) setAuthorLabel(profile.name.trim());
    }).catch(() => {});
    return () => { alive = false; };
  }, [author, me]);

  // 고른 파일의 미리보기. objectURL 은 직접 해제하지 않으면 메모리에 남는다.
  useEffect(() => {
    const urls = picked.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    setUnpreviewable([]);
    return () => urls.forEach(URL.revokeObjectURL);
  }, [picked]);

  async function remove(photo: Photo) {
    if (removing) return;
    if (!confirm("이 사진을 지울까요? 되돌릴 수 없어요")) return;

    setRemoving(photo.id);
    setError("");
    try {
      await deletePhoto(photo);
      setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "사진을 지우지 못했어요");
    } finally {
      setRemoving(null);
    }
  }

  async function save() {
    if (saving) return;
    setSaving(true);
    setError("");

    try {
      const dateId = await saveMemo(dateKey, memo, me);

      if (picked.length > 0) {
        setProgress({ done: 0, total: picked.length });
        // 한 장씩 올린다. 동시에 올리면 진행 표시가 의미를 잃고
        // 모바일 회선에서 오히려 느려진다.
        let sort = photos.length;
        for (const [i, file] of picked.entries()) {
          try {
            const blob = await resizeImage(file);
            await uploadPhoto(dateKey, dateId, blob, sort + i);
          } catch (e) {
            const why = e instanceof Error ? e.message : "알 수 없는 오류";
            throw new Error(`${i + 1}번째 사진에서 멈췄어요 — ${why}`);
          }
          setProgress({ done: i + 1, total: picked.length });
        }
      }

      setPicked([]);
      setProgress(null);
      const fresh = await loadDate(dateKey);
      setPhotos(fresh.photos);
      setAuthor(fresh.record?.author ?? null);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장에 실패했어요");
      setProgress(null);
    } finally {
      setSaving(false);
    }
  }

  const dirty = picked.length > 0 || !loading;

  return (
    <div className="fixed inset-0 z-50 flex items-end" role="dialog" aria-modal="true">
      <button
        aria-label="닫기"
        onClick={onClose}
        className="absolute inset-0 bg-black/30"
      />

      <section className="relative mx-auto flex max-h-[88dvh] w-full max-w-md flex-col rounded-t-3xl bg-[#fff7f9] pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-center justify-between px-5 pb-2 pt-3">
          <div className="h-1 w-10 rounded-full bg-[#eccfd8]" />
        </div>

        <header className="flex items-baseline justify-between px-5 pb-3">
          <h2 className="text-lg font-bold">{label}</h2>
          {authorLabel && (
            <span className="text-xs text-[#bda5ae]">{authorLabel}가 씀</span>
          )}
        </header>

        <div className="flex-1 overflow-y-auto px-5">
          {loading ? (
            <p className="py-10 text-center text-sm text-[#bda5ae]">불러오는 중…</p>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2">
                {photos.map((p) => (
                  <div key={p.id} className="relative">
                    {/* next/image 대신 img 를 쓴다. 업로드 전에 이미 1600px 로
                        줄여 올리므로 추가 최적화 이득이 작고, Vercel 이미지
                        최적화 할당량을 쓰지 않는다. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photoUrl(p.path)}
                      alt=""
                      loading="lazy"
                      className="aspect-square w-full rounded-xl object-cover"
                    />
                    <button
                      onClick={() => remove(p)}
                      disabled={removing !== null}
                      aria-label="사진 지우기"
                      className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-sm text-white transition active:scale-90 disabled:opacity-40"
                    >
                      {removing === p.id ? "…" : "×"}
                    </button>
                  </div>
                ))}

                {picked.map((f, i) => (
                  <div key={`${f.name}-${i}`} className="relative">
                    {previews[i] && !unpreviewable.includes(i) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={previews[i]}
                        alt=""
                        className="aspect-square w-full rounded-xl border border-dashed border-[#f0cdd8] object-cover"
                        onError={() =>
                          setUnpreviewable((prev) =>
                            prev.includes(i) ? prev : [...prev, i]
                          )
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
                  className="flex aspect-square w-full items-center justify-center rounded-xl border border-[#f0cdd8] bg-white text-2xl text-[#d8b6c0] transition active:scale-95"
                  aria-label="사진 추가"
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
                  // 실행되는데, 그 전에 value 를 비우면 files 도 같이 비워져
                  // 빈 목록을 읽게 된다.
                  const files = Array.from(e.target.files ?? []);
                  e.target.value = "";
                  setPicked((prev) => [...prev, ...files]);
                }}
              />

              <textarea
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="한 줄 남기기"
                rows={3}
                className="mt-4 w-full resize-none rounded-2xl border border-[#f5d0da] bg-white px-4 py-3 outline-none placeholder:text-[#d8b6c0] focus:border-[#ff8fab]"
              />
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
            {saving
              ? "저장 중…"
              : picked.length > 0
                ? `저장 · 사진 ${picked.length}장`
                : "저장"}
          </button>
        </div>
      </section>
    </div>
  );
}
