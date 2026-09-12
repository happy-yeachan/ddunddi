"use client";

import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";
import { nameOf, PEOPLE, readMe, type PersonId } from "@/lib/me";
import { loadRecentPokes, sendPoke, type Poke } from "@/lib/pokes";

export default function PokePage() {
  const [me, setMe] = useState<PersonId | null>(null);
  const [pokes, setPokes] = useState<Poke[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setMe(readMe());
    loadRecentPokes()
      .then(setPokes)
      .catch(() => setMessage("찌르기 기록을 불러오지 못했어요"));
  }, []);

  const other = PEOPLE.find((person) => person.id !== me);

  async function poke() {
    if (!me || !other || busy) return;
    setBusy(true);
    setMessage("");
    try {
      await sendPoke(me, other.id);
      setPokes(await loadRecentPokes());
      setMessage(`${other.name}에게 찔렀다고 알려줬어요 💕`);
    } catch {
      setMessage("전달하지 못했어요. 잠시 후 다시 시도해주세요");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-md px-6 pt-[calc(2rem+env(safe-area-inset-top))]">
      <header className="mb-8 text-center">
        <div className="mb-3 text-5xl" aria-hidden>👉</div>
        <h1 className="text-2xl font-bold tracking-tight">찌르기</h1>
        <p className="mt-2 text-sm text-[#bda5ae]">생각날 때 살짝 알려줘요</p>
      </header>

      {other && (
        <button
          onClick={poke}
          disabled={!me || busy}
          className="w-full rounded-3xl bg-[#ff8fab] px-5 py-5 text-lg font-semibold text-white shadow-sm transition active:scale-[0.98] disabled:opacity-50"
        >
          {busy ? "전달 중…" : `${other.name} 찌르기`}
        </button>
      )}
      {message && <p className="mt-4 text-center text-sm text-[#e05c7e]">{message}</p>}

      <section className="mt-10">
        <h2 className="mb-3 text-sm font-semibold text-[#bda5ae]">최근 기록</h2>
        <div className="overflow-hidden rounded-2xl bg-white/70">
          {pokes.length === 0 ? (
            <p className="px-5 py-6 text-center text-sm text-[#c5a8b2]">아직 찌른 기록이 없어요</p>
          ) : (
            pokes.map((poke) => (
              <div key={poke.id} className="flex items-center justify-between border-b border-[#fff0f3] px-5 py-4 last:border-0">
                <span className="text-sm">{nameOf(poke.sender)}님이 {nameOf(poke.recipient)}님을 찔렀어요 💕</span>
                <time className="ml-3 shrink-0 text-xs text-[#c5a8b2]">
                  {formatDistanceToNow(new Date(poke.created_at), { addSuffix: true, locale: ko })}
                </time>
              </div>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
