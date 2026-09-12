import { NextResponse } from "next/server";

// 월력요항을 가공한 공개 데이터. 음력 명절·대체공휴일·임시공휴일은
// 직접 추정하지 않고 발표된 자료를 하루마다 갱신한다.
// https://github.com/hyunbinseo/holidays-kr (MIT)
export async function GET(req: Request) {
  const year = new URL(req.url).searchParams.get("year") ?? "";
  if (!/^\d{4}$/.test(year) || Number(year) < 2018 || Number(year) > 2200) {
    return NextResponse.json({ error: "지원하지 않는 연도입니다." }, { status: 400 });
  }
  try {
    const response = await fetch(`https://holidays.hyunbin.page/${year}.json`, { next: { revalidate: 86400 }, signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error("Unavailable");
    const data: unknown = await response.json();
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Invalid data");
    const holidays: Record<string, string[]> = {};
    for (const [date, names] of Object.entries(data)) {
      if (date.startsWith(`${year}-`) && /^\d{4}-\d{2}-\d{2}$/.test(date) && Array.isArray(names) && names.every((name) => typeof name === "string")) holidays[date] = names;
    }
    return NextResponse.json(holidays);
  } catch {
    return NextResponse.json({ error: "해당 연도의 공휴일 정보를 불러오지 못했어요." }, { status: 503 });
  }
}
