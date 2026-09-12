"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { photoUrl } from "@/lib/supabase";
import { PEOPLE, nameOf, type PersonId } from "@/lib/me";
import { loadProfile } from "@/lib/profiles";
import {
  applyEvents,
  deleteNote,
  deletePhoto,
  ensureDate,
  loadDate,
  resizeImage,
  loadDayEvents,
  upsertNote,
  uploadPhoto,
  type EventDraft,
  type EventItem,
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
  // 아직 오지 않은 날에는 일기를 쓰지 않는다. 일정은 앞날에도 잡을 수 있다.
  const isFuture = dateKey > todayKey();

  const [loading, setLoading] = useState(true);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [eventDraft, setEventDraft] = useState<EventDraft[]>([]);

  // 저장을 누르기 전까지는 화면에서만 바뀐다. 버튼 하나가 모든 변경을 책임진다.
  const [draft, setDraft] = useState("");
  const [saved, setSaved] = useState("");
  const [doomed, setDoomed] = useState<string[]>([]);
  const [picked, setPicked] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [unpreviewable, setUnpreviewable] = useState<number[]>([]);

  const [partnerLabel, setPartnerLabel] = useState(nameOf(partner));
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [zoom, setZoom] = useState<string | null>(null);
  const [progress, setProgress] = useState<Progress>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([loadDate(dateKey), loadDayEvents(dateKey)])
      .then(([{ photos, notes }, evs]) => {
        if (!alive) return;
        setPhotos(photos);
        setNotes(notes);
        setEvents(evs);
        setEventDraft(toDraft(evs));
        const mine = notes.find((n) => n.author === me)?.body ?? "";
        setDraft(mine);
        setSaved(mine);
        // 아무것도 없는 날은 보여줄 것이 없으니 바로 쓰는 화면으로 연다.
        if (photos.length === 0 && notes.length === 0 && evs.length === 0) setMode("edit");
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
  const eventsChanged = useMemo(
    () => JSON.stringify(eventDraft) !== JSON.stringify(toDraft(events)),
    [eventDraft, events]
  );
  const dirty = useMemo(
    () =>
      (!isFuture && (draft !== saved || picked.length > 0 || doomed.length > 0)) ||
      eventsChanged,
    [isFuture, draft, saved, picked.length, doomed.length, eventsChanged]
  );

  async function save() {
    if (saving || !dirty) return;
    setSaving(true);
    setError("");

    try {
      const dateId = await ensureDate(dateKey);

      // 지우기부터. 올리기 전에 치워야 사진 순서가 꼬이지 않는다.
      for (const id of isFuture ? [] : doomed) {
        const photo = photos.find((p) => p.id === id);
        if (photo) await deletePhoto(photo);
      }

      if (!isFuture && picked.length > 0) {
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

      await applyEvents(dateKey, me, events, eventDraft);

      const text = isFuture ? "" : draft.trim();
      const mine = notes.find((n) => n.author === me);
      if (text) {
        await upsertNote(dateId, me, text);
      } else if (mine) {
        // 일기를 비우고 저장하면 지운다는 뜻이다.
        await deleteNote(mine.id);
      }

      const [fresh, freshEvents] = await Promise.all([
        loadDate(dateKey),
        loadDayEvents(dateKey),
      ]);
      setPhotos(fresh.photos);
      setNotes(fresh.notes);
      setEvents(freshEvents);
      setEventDraft(toDraft(freshEvents));
      setSaved(text);
      setDraft(text);
      setPicked([]);
      setDoomed([]);
      setProgress(null);
      setMode("view");
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장에 실패했어요");
      setProgress(null);
    } finally {
      setSaving(false);
    }
  }

  function close() {
    if (mode === "edit" && dirty && !confirm("저장하지 않은 변경이 있어요. 닫을까요?")) return;
    onClose();
  }

  function cancelEdit() {
    if (dirty && !confirm("고친 내용을 버릴까요?")) return;
    setDraft(saved);
    setEventDraft(toDraft(events));
    setPicked([]);
    setDoomed([]);
    setError("");
    setMode("view");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end" role="dialog" aria-modal="true">
      <button aria-label="닫기" onClick={close} className="absolute inset-0 bg-black/30" />

      <section className="relative mx-auto flex max-h-[88dvh] w-full max-w-md flex-col rounded-t-3xl bg-[#fff7f9] pb-[env(safe-area-inset-bottom)]">
        <div className="flex justify-center pb-2 pt-3">
          <div className="h-1 w-10 rounded-full bg-[#eccfd8]" />
        </div>

        <header className="flex items-center justify-between px-5 pb-3">
          <h2 className="text-lg font-bold">{label}</h2>
          {!loading && mode === "view" && (
            <button
              onClick={() => setMode("edit")}
              className="rounded-full border border-[#f5d0da] bg-white px-4 py-1.5 text-sm font-medium text-[#c9788f] transition active:scale-95"
            >
              편집
            </button>
          )}
        </header>

        <div className="flex-1 overflow-y-auto px-5">
          {loading ? (
            <p className="py-10 text-center text-sm text-[#bda5ae]">불러오는 중…</p>
          ) : mode === "view" ? (
            <ViewBody
              isFuture={isFuture}
              events={events}
              photos={photos}
              notes={notes}
              me={me}
              partner={partner}
              partnerLabel={partnerLabel}
              onZoom={setZoom}
              onEdit={() => setMode("edit")}
            />
          ) : (
            <>
              <section className="mb-5">
                <h3 className="mb-1.5 text-xs font-medium text-[#bda5ae]">일정</h3>
                <div className="space-y-2">
                  {eventDraft.map((e, i) => (
                    <div key={e.id ?? `new-${i}`} className="flex items-center gap-2">
                      <button
                        onClick={() =>
                          setEventDraft((prev) =>
                            prev.map((x, j) => (j === i ? { ...x, done: !x.done } : x))
                          )
                        }
                        aria-label={e.done ? "완료 취소" : "완료"}
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] transition active:scale-90 ${
                          e.done
                            ? "border-[#ff8fab] bg-[#ff8fab] text-white"
                            : "border-[#f0cdd8] bg-white text-transparent"
                        }`}
                      >
                        ✓
                      </button>
                      <input
                        type="time"
                        value={e.at ? e.at.slice(0, 5) : ""}
                        onChange={(ev) =>
                          setEventDraft((prev) =>
                            prev.map((x, j) =>
                              j === i
                                ? { ...x, at: ev.target.value ? `${ev.target.value}:00` : null }
                                : x
                            )
                          )
                        }
                        className="w-[86px] shrink-0 rounded-xl border border-[#f5d0da] bg-white px-2 py-2 text-sm outline-none focus:border-[#ff8fab]"
                      />
                      <input
                        value={e.title}
                        onChange={(ev) =>
                          setEventDraft((prev) =>
                            prev.map((x, j) => (j === i ? { ...x, title: ev.target.value } : x))
                          )
                        }
                        placeholder="무엇을 할까"
                        className="min-w-0 flex-1 rounded-xl border border-[#f5d0da] bg-white px-3 py-2 text-sm outline-none placeholder:text-[#d8b6c0] focus:border-[#ff8fab]"
                      />
                      <button
                        onClick={() => setEventDraft((prev) => prev.filter((_, j) => j !== i))}
                        aria-label="일정 빼기"
                        className="shrink-0 px-1 text-lg text-[#d8b6c0] transition active:scale-90"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() =>
                    setEventDraft((prev) => [...prev, { id: null, at: null, title: "", done: false }])
                  }
                  className="mt-2 w-full rounded-xl border border-dashed border-[#f0cdd8] py-2.5 text-sm text-[#c9788f] transition active:scale-[0.99]"
                >
                  + 일정 추가
                </button>
              </section>

              <h3 className={`mb-1.5 text-xs font-medium text-[#bda5ae] ${isFuture ? "hidden" : ""}`}>
                사진
              </h3>
              <div className={`grid grid-cols-3 gap-2 ${isFuture ? "hidden" : ""}`}>
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
                  onClick={() => {
                    // 창을 열기 직전에 비운다. onChange 안에서 비우면 iOS 가
                    // 여러 장을 채우는 도중에 끊겨 한 장만 들어온다.
                    if (fileInput.current) fileInput.current.value = "";
                    fileInput.current?.click();
                  }}
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
                  const files = Array.from(e.target.files ?? []);
                  setPicked((prev) => [...prev, ...files]);
                }}
              />

              {isFuture ? (
                <section className="mt-5">
                  <p className="rounded-2xl border border-dashed border-[#f0cdd8] px-4 py-6 text-center text-sm leading-6 text-[#d8b6c0]">
                    아직 오지 않은 날이에요.
                    <br />
                    사진과 일기는 그날이 되면 남길 수 있어요
                  </p>
                </section>
              ) : (
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
              )}

              <section className={`mt-4 mb-2 ${isFuture ? "hidden" : ""}`}>
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

          {mode === "view" ? (
            <button
              onClick={close}
              className="w-full rounded-2xl border border-[#f5d0da] bg-white py-4 text-lg font-semibold text-[#c9788f] transition active:scale-[0.98]"
            >
              닫기
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={cancelEdit}
                disabled={saving}
                className="rounded-2xl border border-[#f5d0da] bg-white px-6 py-4 text-lg font-medium text-[#c9788f] transition active:scale-[0.98] disabled:opacity-40"
              >
                취소
              </button>
              <button
                onClick={save}
                disabled={saving || !dirty}
                className="flex-1 rounded-2xl bg-[#ff8fab] py-4 text-lg font-semibold text-white transition active:scale-[0.98] disabled:opacity-40"
              >
                {saving
                  ? "저장 중…"
                  : summarize(
                      isFuture ? 0 : picked.length,
                      isFuture ? 0 : doomed.length,
                      !isFuture && draft !== saved
                    )}
              </button>
            </div>
          )}
        </div>
      </section>

      {zoom && (
        <button
          onClick={() => setZoom(null)}
          aria-label="닫기"
          className="fixed inset-0 z-10 flex items-center justify-center bg-black/90 p-4"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photoUrl(zoom)} alt="" className="max-h-full max-w-full object-contain" />
        </button>
      )}
    </div>
  );
}

function ViewBody({
  isFuture,
  events,
  photos,
  notes,
  me,
  partner,
  partnerLabel,
  onZoom,
  onEdit,
}: {
  isFuture: boolean;
  events: EventItem[];
  photos: Photo[];
  notes: Note[];
  me: PersonId;
  partner: PersonId;
  partnerLabel: string;
  onZoom: (path: string) => void;
  onEdit: () => void;
}) {
  const mine = notes.find((n) => n.author === me);
  const theirs = notes.find((n) => n.author === partner);

  return (
    <div className="pb-2">
      {events.length > 0 && (
        <section className="mb-5">
          <h3 className="mb-1.5 text-xs font-medium text-[#bda5ae]">일정</h3>
          <ul className="space-y-1.5">
            {events.map((e) => (
              <li
                key={e.id}
                className={`flex items-center gap-2.5 rounded-2xl border border-[#f5d0da] bg-white px-3.5 py-2.5 ${
                  e.done ? "opacity-45" : ""
                }`}
              >
                <span className="w-[42px] shrink-0 text-xs font-medium text-[#c9788f]">
                  {e.at ? e.at.slice(0, 5) : "종일"}
                </span>
                <span className={`min-w-0 flex-1 text-sm ${e.done ? "line-through" : ""}`}>
                  {e.title}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!isFuture && photos.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((p) => (
            <button
              key={p.id}
              onClick={() => onZoom(p.path)}
              className="transition active:scale-95"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photoUrl(p.path)}
                alt=""
                loading="lazy"
                className="aspect-square w-full rounded-xl object-cover"
              />
            </button>
          ))}
        </div>
      )}

      {!isFuture && (
        <>
          <Diary title="내 일기" body={mine?.body} onEdit={onEdit} />
          <Diary title={`${partnerLabel}의 일기`} body={theirs?.body} />
        </>
      )}
    </div>
  );
}

function Diary({
  title,
  body,
  onEdit,
}: {
  title: string;
  body?: string;
  onEdit?: () => void;
}) {
  return (
    <section className="mt-5">
      <h3 className="mb-1.5 text-xs font-medium text-[#bda5ae]">{title}</h3>
      {body ? (
        <div className="whitespace-pre-wrap rounded-2xl border border-[#f5d0da] bg-white px-4 py-3.5 text-sm leading-relaxed">
          {body}
        </div>
      ) : onEdit ? (
        <button
          onClick={onEdit}
          className="w-full rounded-2xl border border-dashed border-[#f0cdd8] px-4 py-6 text-sm text-[#d8b6c0] transition active:scale-[0.99]"
        >
          아직 안 썼어요. 지금 쓰기
        </button>
      ) : (
        <div className="rounded-2xl border border-dashed border-[#f0cdd8] px-4 py-6 text-center text-sm text-[#d8b6c0]">
          아직 안 썼어요
        </div>
      )}
    </section>
  );
}

function todayKey() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function toDraft(list: EventItem[]): EventDraft[] {
  return list.map((e) => ({ id: e.id, at: e.at, title: e.title, done: e.done }));
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
