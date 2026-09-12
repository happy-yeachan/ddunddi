// 게이트 통과 여부와 "나는 누구"를 브라우저에 기억해 둔다.
// 보안 경계가 아니라 다시 묻지 않기 위한 장치다.
export const GATE_KEY = "ddunddi.gate";
export const ME_KEY = "ddunddi.me";

export const PEOPLE = [
  { id: "yeachan", name: "예찬" },
  { id: "daeun", name: "다은" },
] as const;

export type PersonId = (typeof PEOPLE)[number]["id"];

export function readMe(): PersonId | null {
  if (typeof window === "undefined") return null;
  const v = localStorage.getItem(ME_KEY);
  return PEOPLE.some((p) => p.id === v) ? (v as PersonId) : null;
}

export function nameOf(id: PersonId | null) {
  return PEOPLE.find((p) => p.id === id)?.name ?? "";
}
