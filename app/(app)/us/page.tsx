export default function UsPage() {
  return <Placeholder title="우리" />;
}

function Placeholder({ title }: { title: string }) {
  return (
    <main className="flex min-h-[70dvh] flex-col items-center justify-center gap-2">
      <p className="text-xl font-semibold">{title}</p>
      <p className="text-sm opacity-50">준비 중</p>
    </main>
  );
}
