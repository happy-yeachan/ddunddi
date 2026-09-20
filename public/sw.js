self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data?.json() || {}; } catch {}
  event.waitUntil(self.registration.showNotification("뚠띠뚠띠", {
    body: data.body || "상대가 나를 찔렀어요. 앱에서 확인해 보세요.",
    icon: "/icon-192.png", badge: "/favicon.png",
    tag: data.id || "poke", data: { url: "/poke" },
  }));
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const target = new URL("/poke", self.location.origin).href;
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows.filter((item) => new URL(item.url).origin === self.location.origin)) {
      try {
        // 먼저 앱을 활성화한다. navigate로 교체된 이전 client를 focus하면
        // 닫혀 있던 모바일 앱에서 실패하며 알림만 사라질 수 있다.
        const focused = await client.focus();
        const navigated = await focused.navigate(target);
        if (!navigated) continue;
        return;
      } catch {
        // 종료 중인 창이면 다음 창 또는 새 앱 창으로 연결한다.
      }
    }
    const opened = await self.clients.openWindow(target);
    if (opened) await opened.focus().catch(() => {});
  })());
});
