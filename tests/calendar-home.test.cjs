const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve, dirname } = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const { parseISO, format } = require("date-fns");

// 기존 TypeScript 의존성만 사용한다. DB는 대역으로 검증하고 실제 기록은 건드리지 않는다.
function loadTs(file, stubs = {}) {
  const filename = resolve(__dirname, "..", file);
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(dirname(filename));
  const normalRequire = mod.require.bind(mod);
  mod.require = (id) => Object.hasOwn(stubs, id) ? stubs[id] : normalRequire(id);
  mod._compile(ts.transpileModule(readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, filename);
  return mod.exports;
}

const dates = loadTs("lib/calendar-dates.ts");
const day = (key) => parseISO(key);
const settings = { date: "2025-01-01", anniversaries: true, birthdays: true };
const event = (id, at, extra = {}) => ({ id, title: "같은 제목", date: "2025-01-02", at, done: false, ...extra });

test("잘못된 날짜는 보정해서 저장하지 않는다", () => {
  for (const key of ["2025-02-29", "2026-04-31", "2026-13-01", "20260101", "", null]) assert.equal(dates.parseDay(key), null);
  assert.ok(dates.parseDay("2024-02-29"));
});

test("100일은 사귄 날을 포함하며 시작 전에는 표시하지 않는다", () => {
  assert.deepEqual(dates.anniversaryLabels(settings.date, day("2024-12-31")), []);
  assert.deepEqual(dates.anniversaryLabels(settings.date, day("2025-01-01")), ["♥ 사귄 날"]);
  assert.deepEqual(dates.anniversaryLabels(settings.date, day("2025-04-10")), ["100일"]);
  assert.deepEqual(dates.anniversaryLabels(settings.date, day("2025-04-11")), []);
  assert.deepEqual(dates.anniversaryLabels(settings.date, day("2026-01-01")), ["1주년"]);
});

test("윤년 생일과 주년은 홈과 캘린더가 같은 날짜를 표시한다", () => {
  assert.equal(dates.isBirthdayOn("2000-02-29", day("2025-02-28")), true);
  assert.equal(dates.isBirthdayOn("2000-02-29", day("2024-02-28")), false);
  assert.equal(dates.isBirthdayOn("2000-02-29", day("2024-02-29")), true);
  assert.deepEqual(dates.anniversaryLabels("2024-02-29", day("2025-02-28")), ["1주년"]);
  const result = dates.upcomingSpecialDays(day("2025-02-28"), [], [{ subject: "a", name: "상대", birth_date: "2000-02-29" }], { ...settings, anniversaries: false });
  assert.equal(format(result[0].date, "yyyy-MM-dd"), "2025-02-28");
});

test("특별한 날은 다음 100·200·300일을 비교해 정확히 3개만 반환한다", () => {
  const result = dates.upcomingSpecialDays(day("2025-01-02"), [], [], settings);
  assert.deepEqual(result.map((r) => r.label), ["우리 100일", "우리 200일", "우리 300일"]);
});

test("동일 날짜·동일 제목 일정도 시간순이고 키가 중복되지 않는다", () => {
  const result = dates.upcomingSpecialDays(day("2025-01-02"), [event("late", "18:00:00"), event("early", "09:00:00"), event("all", null), event("done", "07:00:00", { done: true })], [], settings);
  assert.deepEqual(result.map((r) => r.id), ["event:early", "event:late", "event:all"]);
});

test("표시 해제는 기념일·생일만 제외하고 일정은 유지한다", () => {
  const result = dates.upcomingSpecialDays(day("2025-01-02"), [event("1", null)], [{ subject: "a", name: "상대", birth_date: "2000-01-02" }], { ...settings, anniversaries: false, birthdays: false });
  assert.deepEqual(result.map((r) => r.id), ["event:1"]);
});

test("지난 생일은 다음 해로, 완료·과거 일정은 목록에서 제외한다", () => {
  const result = dates.upcomingSpecialDays(day("2025-12-31"), [event("old", null)], [{ subject: "a", name: "상대", birth_date: "2000-01-01" }], { ...settings, anniversaries: false });
  assert.equal(format(result[0].date, "yyyy-MM-dd"), "2026-01-01");
  assert.equal(result.length, 1);
});

test("빈 일정 제목은 삭제 등 DB 작업 전에 막는다", async () => {
  let touched = false;
  const records = loadTs("lib/records.ts", { "./supabase": { supabase: { from() { touched = true; throw new Error("DB 호출 금지"); } } } });
  await assert.rejects(records.applyEvents("2025-01-02", "yeachan", [{ id: "existing" }], [{ id: "new", title: "  " }]), /일정 제목/);
  assert.equal(touched, false);
});

test("일정 저장 부분 실패 후 재시도해도 새 일정이 중복되지 않는다", async () => {
  const saved = new Map();
  let fail = true;
  const records = loadTs("lib/records.ts", { "./supabase": { supabase: { from: () => ({ upsert: async (row) => {
    if (row.id === "second" && fail) { fail = false; return { error: new Error("연결 실패") }; }
    saved.set(row.id, row); return { error: null };
  } }) } } });
  const draft = ["first", "second"].map((id) => ({ id, title: id, at: null, owner: "both", done: false }));
  await assert.rejects(records.applyEvents("2025-01-02", "yeachan", [], draft));
  await records.applyEvents("2025-01-02", "yeachan", [], draft);
  assert.equal(saved.size, 2);
});

test("일정 완료만 바꾸면 다른 사람이 변경했을 수 있는 제목은 덮어쓰지 않는다", async () => {
  let patch;
  const chain = { eq: () => chain, then: (resolve) => Promise.resolve({ error: null }).then(resolve) };
  const records = loadTs("lib/records.ts", { "./supabase": { supabase: { from: () => ({ update: (value) => { patch = value; return chain; } }) } } });
  const before = { id: "a", title: "기존 제목", at: null, owner: "both", done: false };
  await records.applyEvents("2025-01-02", "yeachan", [before], [{ ...before, done: true }]);
  assert.deepEqual(patch, { done: true });
});

test("빈 날짜 행은 일기 표시로 취급하지 않고 사진·일기 기록만 표시한다", async () => {
  const chain = { select: () => chain, gte: () => chain, lte: async () => ({ error: null, data: [
    { id: "empty", date: "2025-01-01", date_photos: [], date_notes: [] },
    { id: "note", date: "2025-01-02", date_photos: [], date_notes: [{ id: "n" }] },
    { id: "photo", date: "2025-01-03", date_photos: [{ path: "p", sort: 2 }], date_notes: [] },
  ] }) };
  const records = loadTs("lib/records.ts", { "./supabase": { supabase: { from: () => chain } } });
  const month = await records.loadMonth("2025-01-01", "2025-01-31");
  assert.deepEqual([...month.keys()], ["2025-01-02", "2025-01-03"]);
});

test("사귄 날짜가 없어도 표시 설정은 저장할 수 있다", async () => {
  let payload;
  const api = loadTs("lib/settings.ts", { "./calendar-dates": dates, "./supabase": { supabase: { from: () => ({ upsert: async (value) => { payload = value; return { error: null }; } }) } } });
  await api.saveRelationshipDate("", false, true);
  assert.equal(payload.relationship_date, null);
  assert.equal(payload.show_birthdays, true);
  await assert.rejects(api.saveRelationshipDate("2025-02-29"), /실제 날짜/);
});
