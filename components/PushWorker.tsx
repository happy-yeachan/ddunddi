"use client";

import { useEffect } from "react";

export default function PushWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    // 알림 설정을 다시 누르지 않아도 클릭 처리 수정본을 받는다.
    const update = () => {
      if (document.visibilityState !== "visible") return;
      navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" })
        .then((registration) => registration.update()).catch(() => {});
    };
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  return null;
}
