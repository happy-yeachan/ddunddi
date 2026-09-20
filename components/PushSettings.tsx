"use client";

import { useEffect, useState } from "react";
import { readMe } from "@/lib/me";

export default function PushSettings() {
  const [supported, setSupported] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [key, setKey] = useState("");
  async function refresh() {
    const response = await fetch("/api/push", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) { setMessage(data.message); return; }
    setKey(data.publicKey); setMessage("");
    if ("serviceWorker" in navigator && "PushManager" in window) {
      const registration = await navigator.serviceWorker.getRegistration("/");
      const subscription = await registration?.pushManager.getSubscription();
      setEnabled(Boolean(subscription && localStorage.getItem("ddunddi-push-person") === readMe() && Notification.permission === "granted"));
    }
  }
  useEffect(() => {
    setSupported("serviceWorker" in navigator && "PushManager" in window && "Notification" in window && window.isSecureContext);
    refresh().catch(() => setMessage("알림 설정을 불러오지 못했어요. 다시 시도해주세요."));
  }, []);
  async function toggle() {
    const me = readMe(); if (!me || busy) return;
    setBusy(true); setMessage("");
    try {
      // iOS는 클릭 이벤트에서 직접 권한을 요청해야 한다.
      if (!enabled && await Notification.requestPermission() !== "granted") throw new Error("알림이 차단되어 있어요. 기기 또는 브라우저 설정에서 알림을 허용해주세요.");
      await navigator.serviceWorker.register("/sw.js");
      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      if (enabled && subscription) {
        const response = await fetch("/api/push", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "unsubscribe", person: me, endpoint: subscription.endpoint }) });
        if (!response.ok) throw new Error("알림 해제에 실패했어요. 다시 시도해주세요.");
        await subscription.unsubscribe();
        localStorage.removeItem("ddunddi-push-person"); setEnabled(false); setMessage("이 기기의 찌르기 알림을 껐어요."); return;
      }
      const bytes = Uint8Array.from(atob(key.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
      if (subscription) {
        const currentKey = subscription.options.applicationServerKey;
        if (!currentKey || Array.from(new Uint8Array(currentKey)).join() !== Array.from(bytes).join()) { await subscription.unsubscribe(); subscription = null; }
      }
      subscription ??= await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes });
      const response = await fetch("/api/push", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "subscribe", person: me, subscription: subscription.toJSON() }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "알림 설정을 저장하지 못했어요.");
      localStorage.setItem("ddunddi-push-person", me); setEnabled(true); setMessage("이 기기에서 찌르기 알림을 받을 수 있어요.");
    } catch (e) { setMessage((e as Error).message || "알림을 설정하지 못했어요."); }
    finally { setBusy(false); }
  }
  return <section className="mt-6 rounded-app border border-app-border bg-white p-5">
    <h2 className="font-semibold">찌르기 알림</h2>
    <p className="mt-2 text-sm leading-relaxed text-app-muted">상대가 찌르면 이 기기에서 알림을 받아요. 서로 각자의 기기에서 켜주세요.</p>
    <p className="mt-2 text-xs leading-relaxed text-app-muted">아이폰·아이패드는 iOS 16.4 이상에서 Safari → 공유 → 홈 화면에 추가 후, 홈 화면의 앱을 열어 설정해주세요.</p>
    {supported ? <button onClick={toggle} disabled={busy || !key} className="mt-4 rounded-xl bg-app-accent px-4 py-3 text-sm font-semibold text-app-on-accent disabled:opacity-50">{busy ? "설정 중…" : enabled ? "이 기기 알림 끄기" : "이 기기 알림 받기"}</button> : <p className="mt-4 text-sm">이 브라우저에서는 알림을 사용할 수 없어요. 지원되는 브라우저나 홈 화면 앱에서 열어주세요.</p>}
    {message && <p role="status" className="mt-3 text-sm">{message}</p>}
    {!key && <button onClick={() => refresh().catch(() => setMessage("다시 불러오지 못했어요."))} className="mt-3 text-sm underline">다시 불러오기</button>}
  </section>;
}
