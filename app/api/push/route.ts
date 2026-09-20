import { NextRequest, NextResponse } from "next/server";
import webpush, { type PushSubscription } from "web-push";
import { supabase } from "@/lib/supabase";
import { decrypt, encrypt, endpointId, validEndpoint } from "@/lib/push-security";
import { nameOf, type PersonId } from "@/lib/me";

export const runtime = "nodejs";
const person = (value: unknown): value is PersonId => value === "yeachan" || value === "daeun";
type Subscription = { person: PersonId; subscription: PushSubscription };
type Keys = { publicKey: string; privateKey: string };
async function keys() {
  const { data, error } = await supabase.from("push_config").select("payload").eq("id", "vapid").single();
  if (error) throw error;
  return decrypt<Keys>(data.payload);
}
export async function GET() {
  try { return NextResponse.json({ publicKey: (await keys()).publicKey }, { headers: { "Cache-Control": "no-store" } }); }
  catch { return NextResponse.json({ message: "알림 서버를 준비 중이에요. 잠시 후 다시 시도해주세요." }, { status: 503 }); }
}
export async function POST(req: NextRequest) {
  if (req.headers.get("origin") !== req.nextUrl.origin) return NextResponse.json({}, { status: 403 });
  const raw = await req.text();
  if (raw.length > 12000) return NextResponse.json({}, { status: 413 });
  let body;
  try { body = JSON.parse(raw); } catch { return NextResponse.json({}, { status: 400 }); }
  if (!person(body?.person)) return NextResponse.json({}, { status: 400 });
  try {
    if (body.action === "subscribe") {
      const sub = body.subscription;
      if (!validEndpoint(sub?.endpoint) || typeof sub?.keys?.p256dh !== "string" || typeof sub?.keys?.auth !== "string" || !/^[\w-]{87}$/.test(sub.keys.p256dh) || !/^[\w-]{22}$/.test(sub.keys.auth)) return NextResponse.json({ message: "올바른 알림 구독이 아니에요." }, { status: 400 });
      const { error } = await supabase.from("push_subscriptions").upsert({ id: endpointId(sub.endpoint), person: body.person, payload: encrypt({ person: body.person, subscription: sub }), updated_at: new Date().toISOString() });
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }
    if (body.action === "unsubscribe") {
      if (!validEndpoint(body.endpoint)) return NextResponse.json({}, { status: 400 });
      const { error } = await supabase.from("push_subscriptions").delete().eq("id", endpointId(body.endpoint)).eq("person", body.person);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }
    if (body.action !== "poke" || typeof body.id !== "string" || !/^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i.test(body.id)) return NextResponse.json({}, { status: 400 });
    const sender = body.person;
    const recipient: PersonId = sender === "yeachan" ? "daeun" : "yeachan";
    const { data: recorded, error } = await supabase.rpc("record_push_poke", { poke_id: body.id, poke_sender: sender, poke_recipient: recipient });
    if (error) throw error;
    if (recorded === "limited") return NextResponse.json({ message: "잠깐만요. 10초 뒤에 다시 찔러주세요." }, { status: 429 });
    if (recorded === "duplicate") return NextResponse.json({ message: "이미 저장된 찌르기예요. 중복 알림은 보내지 않았어요." });
    // 기록 저장과 푸시 결과를 분리한다. 알림 실패 후 재시도로 중복 기록을 만들지 않는다.
    try {
      const vapid = await keys();
      const { data: rows, error: loadError } = await supabase.from("push_subscriptions").select("id, payload").eq("person", recipient);
      if (loadError) throw loadError;
      const { data: profile } = await supabase.from("profiles").select("name").eq("author", recipient).eq("subject", sender).maybeSingle();
      const nickname = profile?.name?.trim() || nameOf(sender);
      const results = await Promise.allSettled((rows ?? []).map(async (row) => {
        const saved = decrypt<Subscription>(row.payload);
        if (saved.person !== recipient || !validEndpoint(saved.subscription.endpoint)) throw new Error("Invalid subscription");
        try {
          await webpush.sendNotification(saved.subscription, JSON.stringify({ id: body.id, body: `${nickname}님이 나를 찔렀어요. 지금 내 생각 중인가 봐요!` }), {
            vapidDetails: { ...vapid, subject: "https://ddunddi.yeachan.cloud" }, TTL: 3600, urgency: "high", timeout: 5000,
          });
        } catch (e) {
          const code = (e as { statusCode?: number }).statusCode;
          if (code === 404 || code === 410) await supabase.from("push_subscriptions").delete().eq("id", row.id).eq("payload", row.payload);
          throw e;
        }
      }));
      const sent = results.filter((r) => r.status === "fulfilled").length;
      return NextResponse.json({ message: sent ? "찌르기를 저장하고 상대 기기에 알림을 보냈어요." : rows?.length ? "찌르기는 저장했지만 알림을 보내지 못했어요. 상대의 알림 설정을 확인해주세요." : "찌르기를 저장했어요. 상대가 알림 받기를 켜면 푸시 알림도 보낼 수 있어요." });
    } catch { return NextResponse.json({ message: "찌르기는 저장했지만 알림 전송에 실패했어요." }); }
  } catch { return NextResponse.json({ message: "처리하지 못했어요. 잠시 후 다시 시도해주세요." }, { status: 503 }); }
}
