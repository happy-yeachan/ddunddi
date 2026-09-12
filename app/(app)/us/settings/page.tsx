import Link from "next/link";

export default function SettingsPage() {
  return <main className="mx-auto max-w-md px-6 pb-8 pt-[calc(2rem+env(safe-area-inset-top))]">
    <Link href="/us" className="text-sm text-app-muted">← 우리 홈으로</Link>
    <h1 className="mb-2 mt-5 text-2xl font-bold">설정</h1>
    <p className="mb-8 text-sm text-app-muted">우리의 소개와 나만의 화면을 관리해요.</p>
    <div className="space-y-3">
      {[
        { href: "/us/settings/profile", icon: "♡", title: "소개서 편집", description: "내가 쓰는 상대의 사진과 소개" },
        { href: "/us/settings/customize", icon: "✿", title: "화면 꾸미기", description: "대표 색상, 글자, 배경과 카드 모양" },
        { href: "/calendar/settings", icon: "▦", title: "캘린더 설정", description: "사귄 날짜와 생일·기념일 표시" },
      ].map((item) => <Link key={item.href} href={item.href} className="flex items-center gap-4 rounded-app border border-app-border bg-white p-5 transition hover:bg-app-soft focus-visible:outline-2 focus-visible:outline-app-accent">
        <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-app-soft text-2xl text-app-accent">{item.icon}</span>
        <div className="flex-1"><h2 className="font-semibold">{item.title}</h2><p className="mt-1 text-xs leading-relaxed text-app-muted">{item.description}</p></div><span aria-hidden="true">→</span>
      </Link>)}
    </div>
  </main>;
}
