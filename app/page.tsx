"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { GATE_KEY, ME_KEY, PEOPLE, readMe } from "@/lib/me";

type Step = "checking" | "password" | "who";

export default function Gate() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("checking");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // localStorage 는 서버에 없으므로 마운트 후에 읽는다.
  useEffect(() => {
    const passed = localStorage.getItem(GATE_KEY) === "ok";
    if (passed && readMe()) {
      router.replace("/us");
      return;
    }
    setStep(passed ? "who" : "password");
  }, [router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");

    try {
      const res = await fetch("/api/gate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok && data.ok) {
        localStorage.setItem(GATE_KEY, "ok");
        setPassword("");
        setStep("who");
      } else {
        setError(data.message ?? "비밀번호가 맞지 않아요");
      }
    } catch {
      setError("연결에 실패했어요. 잠시 후 다시 시도해주세요");
    } finally {
      setBusy(false);
    }
  }

  function pick(id: string) {
    localStorage.setItem(ME_KEY, id);
    router.replace("/us");
  }

  if (step === "checking") {
    return <main className="min-h-dvh" />;
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-8 pb-[env(safe-area-inset-bottom)]">
      <div className="mb-10 flex flex-col items-center gap-3">
        <Heart className="h-14 w-14" />
        <h1 className="text-2xl font-bold tracking-tight">뚠띠뚠띠</h1>
      </div>

      {step === "password" ? (
        <form onSubmit={submit} className="w-full max-w-xs">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="비밀번호"
            autoFocus
            autoComplete="current-password"
            className="w-full rounded-2xl border border-[#f5d0da] bg-white px-5 py-4 text-center text-lg outline-none placeholder:text-[#d8b6c0] focus:border-[#ff8fab]"
          />
          {error && (
            <p className="mt-3 text-center text-sm text-[#e05c7e]">{error}</p>
          )}
          <button
            type="submit"
            disabled={busy || password.length === 0}
            className="mt-4 w-full rounded-2xl bg-[#ff8fab] py-4 text-lg font-semibold text-white transition active:scale-[0.98] disabled:opacity-40"
          >
            {busy ? "확인 중…" : "들어가기"}
          </button>
        </form>
      ) : (
        <div className="w-full max-w-xs">
          <p className="mb-5 text-center text-lg">나는 누구?</p>
          <div className="grid grid-cols-2 gap-3">
            {PEOPLE.map((p) => (
              <button
                key={p.id}
                onClick={() => pick(p.id)}
                className="rounded-2xl border border-[#f5d0da] bg-white py-6 text-xl font-semibold transition active:scale-[0.98]"
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}

function Heart({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="#ff8fab" aria-hidden>
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
    </svg>
  );
}
