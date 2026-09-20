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
const theme = loadTs("lib/theme.ts");
const pushSecurity = loadTs("lib/push-security.ts");

test("푸시 세션은 만료와 변조를 거부하고 구독 암호문은 인증한다", () => {
  const previous = process.env.GATE_PASSWORD;
  process.env.GATE_PASSWORD = "test-only-push-secret";
  try {
    const token = pushSecurity.sessionToken();
    assert.equal(pushSecurity.validSession(token), true);
    assert.equal(pushSecurity.validSession(token + "x"), false);
    assert.equal(pushSecurity.validSession(pushSecurity.sessionToken(Date.now() - 1000)), false);
    const data = { endpoint: "https://fcm.googleapis.com/test", person: "daeun" };
    const ciphertext = pushSecurity.encrypt(data);
    assert.deepEqual(pushSecurity.decrypt(ciphertext), data);
    const tampered = Buffer.from(ciphertext, "base64url"); tampered[30] ^= 1;
    assert.throws(() => pushSecurity.decrypt(tampered.toString("base64url")));
  } finally { if (previous === undefined) delete process.env.GATE_PASSWORD; else process.env.GATE_PASSWORD = previous; }
});

test("푸시 endpoint는 내부망과 위장 도메인을 거부한다", () => {
  for (const endpoint of ["http://fcm.googleapis.com/test", "https://127.0.0.1/x", "https://fcm.googleapis.com.evil.test/x", "https://a@fcm.googleapis.com/x", "https://fcm.googleapis.com:8443/x"]) assert.equal(pushSecurity.validEndpoint(endpoint), false);
  for (const endpoint of ["https://fcm.googleapis.com/x", "https://web.push.apple.com/x", "https://updates.push.services.mozilla.com/x"]) assert.equal(pushSecurity.validEndpoint(endpoint), true);
});

test("찌르기 API는 추가 로그인 없이 동작하며 외부 출처·중복·쿨다운을 검사한다", async () => {
  const { NextRequest } = require("next/server");
  const previous = process.env.GATE_PASSWORD;
  process.env.GATE_PASSWORD = "test-only-push-secret";
  let recorded = "created", sendCount = 0, expired = false, deleted = false;
  const subscription = { endpoint: "https://fcm.googleapis.com/x", keys: { auth: "a", p256dh: "b" } };
  const db = {
    rpc: async () => ({ data: recorded, error: null }),
    from: (table) => {
      const query = {
        select() { return this; }, eq() { return this; },
        single: async () => ({ data: { payload: pushSecurity.encrypt({ publicKey: "public", privateKey: "private" }) } }),
        maybeSingle: async () => ({ data: { name: "상대가 정한 별명" } }),
        delete() { deleted = true; return this; },
        then(resolve) { return Promise.resolve({ data: table === "push_subscriptions" ? [{ id: "id", payload: pushSecurity.encrypt({ person: "daeun", subscription }) }] : null }).then(resolve); },
      };
      return query;
    },
  };
  const route = loadTs("app/api/push/route.ts", {
    "@/lib/push-security": pushSecurity, "@/lib/supabase": { supabase: db }, "@/lib/me": { nameOf: () => "이름" },
    "web-push": { sendNotification: async (_sub, payload) => { sendCount++; assert.match(payload, /상대가 정한 별명/); if (expired) throw { statusCode: 410 }; } },
  });
  const request = (cookie = true, origin = "https://app.test") => new NextRequest("https://app.test/api/push", { method: "POST", headers: { origin, "Content-Type": "application/json", ...(cookie ? { cookie: `ddunddi-session=${pushSecurity.sessionToken()}` } : {}) }, body: JSON.stringify({ action: "poke", person: "yeachan", id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa" }) });
  try {
    assert.equal((await route.GET()).status, 200);
    assert.equal((await route.POST(request(true, "https://evil.test"))).status, 403);
    recorded = "duplicate"; await route.POST(request(false)); assert.equal(sendCount, 0);
    recorded = "limited"; assert.equal((await route.POST(request())).status, 429); assert.equal(sendCount, 0);
    recorded = "created"; const success = await route.POST(request()); assert.match((await success.json()).message, /알림을 보냈/); assert.equal(sendCount, 1);
    expired = true; const failure = await route.POST(request()); assert.equal(failure.status, 200); assert.match((await failure.json()).message, /저장했지만/); assert.equal(deleted, true);
  } finally { if (previous === undefined) delete process.env.GATE_PASSWORD; else process.env.GATE_PASSWORD = previous; }
});

test("손상된 꾸미기 설정은 안전한 기본값으로 복구한다", () => {
  assert.deepEqual(theme.normalizeTheme(null), theme.DEFAULT_THEME);
  assert.deepEqual(theme.normalizeTheme({ accent: "url(bad)", text: "#fff", background: 12, size: 300, rounded: "false" }), theme.DEFAULT_THEME);
});

test("사용자별 꾸미기를 분리하고 저장 실패를 숨기지 않는다", () => {
  const values = new Map();
  const previousStorage = global.localStorage;
  const previousWindow = global.window;
  global.localStorage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  global.window = { dispatchEvent: () => {} };
  try {
    theme.saveTheme("yeachan", { ...theme.DEFAULT_THEME, accent: "#123456" });
    assert.equal(theme.readTheme("yeachan").accent, "#123456");
    assert.deepEqual(theme.readTheme("daeun"), theme.DEFAULT_THEME);
    values.set("ddunddi-theme-daeun", "broken json");
    assert.deepEqual(theme.readTheme("daeun"), theme.DEFAULT_THEME);
    global.localStorage.setItem = () => { throw new Error("quota"); };
    assert.throws(() => theme.saveTheme("yeachan", theme.DEFAULT_THEME), /quota/);
  } finally { global.localStorage = previousStorage; global.window = previousWindow; }
});

test("밝고 어두운 대표 색상에서 버튼 글자가 읽히도록 자동 선택한다", () => {
  for (const accent of ["#ffffff", "#000000", "#ff8fab", "#83b5e0"]) {
    const style = theme.themeStyle({ ...theme.DEFAULT_THEME, accent });
    assert.ok(theme.contrast(accent, style["--app-on-accent"]) >= 4.5);
  }
});
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
