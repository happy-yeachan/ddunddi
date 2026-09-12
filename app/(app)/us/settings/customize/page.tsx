"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { readMe } from "@/lib/me";
import { contrast, DEFAULT_THEME, readTheme, saveTheme, themeStyle, type Theme } from "@/lib/theme";

const PRESETS = [
  { name: "딸기 우유", accent: "#ff8fab", background: "#fff7f9", text: "#3d2b33" },
  { name: "라벤더", accent: "#ac92db", background: "#f7f4fc", text: "#393047" },
  { name: "민트 산책", accent: "#75baa5", background: "#f1f9f5", text: "#28423a" },
  { name: "살구빛", accent: "#eda777", background: "#fff8f0", text: "#4b352b" },
  { name: "맑은 하늘", accent: "#83b5e0", background: "#f2f7fc", text: "#2c3c50" },
];

export default function CustomizePage() {
  const [draft, setDraft] = useState<Theme>(DEFAULT_THEME);
  const [saved, setSaved] = useState<Theme>(DEFAULT_THEME);
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => { const me = readMe(); if (me) { const theme = readTheme(me); setDraft(theme); setSaved(theme); setReady(true); } }, []);
  function change(patch: Partial<Theme>) { setDraft((value) => ({ ...value, ...patch })); setMessage(""); }
  const readable = contrast(draft.text, draft.background) >= 4.5 && contrast(draft.text, "#ffffff") >= 4.5;
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  function submit() {
    const me = readMe(); if (!me || !readable) return;
    try { saveTheme(me, draft); setSaved({ ...draft }); setMessage("꾸미기를 저장했어요. 앱 전체에 적용했어요."); }
    catch { setMessage("저장 공간에 접근하지 못했어요. 브라우저 설정을 확인하고 다시 시도해주세요."); }
  }
  return <main className="mx-auto max-w-md px-6 pb-8 pt-[calc(2rem+env(safe-area-inset-top))]">
    <Link href="/us/settings" className="text-sm text-app-muted">← 설정으로</Link>
    <h1 className="mb-2 mt-5 text-2xl font-bold">화면 꾸미기</h1>
    <p className="mb-6 text-sm leading-relaxed text-app-muted">내 취향으로 물들이는 둘만의 공간.<br />이 브라우저에서 내가 보는 화면에만 적용돼요.</p>
    <fieldset disabled={!ready} className="space-y-6 disabled:opacity-50">
      <section><h2 className="mb-3 font-semibold">추천 테마</h2><div className="flex flex-wrap gap-2">{PRESETS.map((preset) => <button type="button" key={preset.name} aria-pressed={draft.accent === preset.accent && draft.background === preset.background && draft.text === preset.text} onClick={() => change({ accent: preset.accent, background: preset.background, text: preset.text })} className="flex items-center gap-2 rounded-full border border-app-border bg-white px-3 py-2 text-xs aria-pressed:ring-2 aria-pressed:ring-app-accent"><span className="h-4 w-4 rounded-full" style={{ background: preset.accent }} />{preset.name}</button>)}</div></section>
      <section className="rounded-app bg-white p-4"><h2 className="mb-2 font-semibold">색상 직접 고르기</h2>{([
        ["accent", "대표 색상", "버튼과 강조 영역"], ["text", "글자 색상", "본문과 제목"], ["background", "배경 색상", "화면 전체의 바탕"],
      ] as const).map(([key, title, description]) => <label key={key} className="flex items-center justify-between gap-3 border-b border-app-border py-3 last:border-0"><span><span className="block text-sm">{title}</span><span className="text-xs text-app-muted">{description}</span></span><span className="flex items-center gap-2"><span className="text-xs uppercase text-app-muted">{draft[key]}</span><input type="color" value={draft[key]} onChange={(e) => change({ [key]: e.target.value })} aria-label={title} className="h-10 w-10 cursor-pointer rounded-lg" /></span></label>)}</section>
      <section><h2 className="mb-3 font-semibold">글자 크기</h2><div className="grid grid-cols-3 gap-2">{[[14, "작게"], [16, "기본"], [18, "크게"]].map(([size, label]) => <button type="button" key={size} aria-pressed={draft.size === size} onClick={() => change({ size: Number(size) })} className="rounded-xl border border-app-border bg-white py-3 text-sm aria-pressed:bg-app-soft aria-pressed:ring-2 aria-pressed:ring-app-accent">{label}</button>)}</div></section>
      <label className="flex items-center justify-between rounded-app bg-white p-4"><span className="text-sm">둥근 카드 모서리</span><input type="checkbox" checked={draft.rounded} onChange={(e) => change({ rounded: e.target.checked })} className="h-5 w-5 accent-app-accent" /></label>
      <section aria-label="테마 미리보기"><h2 className="mb-3 font-semibold">미리보기</h2><div style={themeStyle(draft)} className="rounded-app border border-app-border bg-app-background p-5 text-app-text"><div className="rounded-app bg-app-soft p-5 text-center"><span aria-hidden="true" className="text-app-accent">♡</span><p style={{ fontSize: "1.25em" }} className="mt-2 font-bold">오늘도 함께하는 우리</p><p style={{ fontSize: ".8em" }} className="mt-2">평범한 하루도 함께라서 특별해.</p></div><div className="mt-3 rounded-app bg-white p-4"><p style={{ fontSize: ".875em" }}>곧 찾아올 특별한 날</p><p style={{ fontSize: ".75em" }} className="mt-1 text-app-muted">우리의 소중한 기념일</p></div><span style={{ fontSize: ".875em" }} className="mt-3 block rounded-xl bg-app-accent px-4 py-3 text-center font-semibold text-app-on-accent">오늘의 우리 기록</span></div></section>
      {!readable && <p role="alert" className="text-sm">글자가 배경이나 흰 카드에서 잘 보이지 않아요. 글자를 더 어둡게 하거나 배경을 밝게 바꿔주세요.</p>}
      <p className="text-xs text-app-muted">저장 전에는 미리보기에만 반영돼요. 나가면 저장하지 않은 변경은 취소돼요.</p>
      <button type="button" onClick={submit} disabled={!dirty || !readable} className="w-full rounded-2xl bg-app-accent py-4 font-semibold text-app-on-accent disabled:opacity-50">꾸미기 저장</button>
      <button type="button" onClick={() => change({ ...DEFAULT_THEME })} className="w-full text-sm text-app-muted underline">기본 꾸미기로 되돌리기</button>
    </fieldset>
    {message && <p role="status" className="mt-4 text-center text-sm">{message}</p>}
  </main>;
}
