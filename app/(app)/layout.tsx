"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { GATE_KEY, readMe } from "@/lib/me";

const TABS = [
  { href: "/calendar", label: "캘린더" },
  { href: "/us", label: "우리" },
  { href: "/poke", label: "찌르기" },
];

// 세 탭이 같은 게이트 검사와 탭바를 쓴다. 라우트 그룹으로 묶어
// 페이지마다 같은 코드를 반복하지 않는다.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(GATE_KEY) !== "ok" || !readMe()) {
      router.replace("/");
      return;
    }
    setReady(true);
  }, [router]);

  if (!ready) return <div className="min-h-dvh" />;

  return (
    <div className="min-h-dvh pb-[calc(4.5rem+env(safe-area-inset-bottom))]">
      {children}

      <nav className="fixed inset-x-0 bottom-0 border-t border-[#f5d0da] bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div className="mx-auto grid max-w-md grid-cols-3">
          {TABS.map((t) => {
            const active = pathname === t.href;
            return (
              <Link
                key={t.href}
                href={t.href}
                className={`py-4 text-center text-sm font-medium transition ${
                  active ? "text-[#ff8fab]" : "text-[#c5a8b2]"
                }`}
              >
                {t.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
