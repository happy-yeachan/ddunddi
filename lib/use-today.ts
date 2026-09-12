"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";

// 날짜만 상태로 보관해 자정·앱 복귀 때 D-day를 갱신하되 불필요한 조회는 막는다.
export function useToday() {
  const [today, setToday] = useState(() => format(new Date(), "yyyy-MM-dd"));
  useEffect(() => {
    const update = () => setToday(format(new Date(), "yyyy-MM-dd"));
    const interval = window.setInterval(update, 30000);
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", update);
    return () => { clearInterval(interval); window.removeEventListener("focus", update); document.removeEventListener("visibilitychange", update); };
  }, []);
  return today;
}
