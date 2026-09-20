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
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const client = windows.find((item) => new URL(item.url).origin === self.location.origin);
    if (client) { await client.navigate("/poke"); return client.focus(); }
    return self.clients.openWindow("/poke");
  })());
});
