import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";

// 비밀번호는 서버에서만 비교한다. NEXT_PUBLIC_ 으로 내보내면 값이
// 브라우저 번들에 그대로 박혀서 게이트가 의미를 잃는다.
export async function POST(req: Request) {
  const expected = process.env.GATE_PASSWORD;
  if (!expected) {
    return NextResponse.json(
      { ok: false, message: "서버에 비밀번호가 설정되지 않았습니다." },
      { status: 500 }
    );
  }

  const body = await req.json().catch(() => null);
  const given = typeof body?.password === "string" ? body.password : "";

  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  const ok = a.length === b.length && timingSafeEqual(a, b);

  return NextResponse.json({ ok }, { status: ok ? 200 : 401 });
}
