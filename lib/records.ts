import { format } from "date-fns";
import { PHOTO_BUCKET, supabase } from "./supabase";
import type { PersonId } from "./me";

export type DateRecord = {
  id: string;
  date: string;
  title: string | null;
  body: string | null;
  author: string | null;
};

export type Photo = { id: string; path: string; sort: number };

// Date → 'yyyy-MM-dd'. toISOString() 은 UTC 로 바꾸면서 한국 시간 자정 근처의
// 날짜를 하루 밀어버리므로 쓰지 않는다.
export function dateKey(d: Date) {
  return format(d, "yyyy-MM-dd");
}

export async function loadDate(key: string) {
  const { data: record, error } = await supabase
    .from("dates")
    .select("id, date, title, body, author")
    .eq("date", key)
    .maybeSingle();
  if (error) throw error;
  if (!record) return { record: null, photos: [] as Photo[] };

  const { data: photos, error: pErr } = await supabase
    .from("date_photos")
    .select("id, path, sort")
    .eq("date_id", record.id)
    .order("sort", { ascending: true });
  if (pErr) throw pErr;

  return { record: record as DateRecord, photos: (photos ?? []) as Photo[] };
}

// 그 달 범위의 기록과 각 날짜의 첫 사진. 7단계 캘린더 썸네일이 쓴다.
export async function loadMonth(fromKey: string, toKey: string) {
  const { data: rows, error } = await supabase
    .from("dates")
    .select("id, date, date_photos(path, sort)")
    .gte("date", fromKey)
    .lte("date", toKey);
  if (error) throw error;

  const map = new Map<string, { id: string; cover: string | null }>();
  for (const r of rows ?? []) {
    const photos = (r.date_photos ?? []) as { path: string; sort: number }[];
    const cover = photos.slice().sort((a, b) => a.sort - b.sort)[0]?.path ?? null;
    map.set(r.date as string, { id: r.id as string, cover });
  }
  return map;
}

export async function saveMemo(key: string, body: string, author: PersonId) {
  const { data, error } = await supabase
    .from("dates")
    .upsert(
      { date: key, body, author, body_source: "human" },
      { onConflict: "date" }
    )
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

// 긴 변 기준으로 줄여 JPEG 로 만든다. 원본을 그대로 올리면 폰 사진 한 장이
// 수 MB 라 업로드가 하염없이 길어진다.
export async function resizeImage(file: File, maxEdge = 1600): Promise<Blob> {
  // imageOrientation 을 주지 않으면 세로로 찍은 사진이 눕는다.
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("캔버스를 만들 수 없어요");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("이미지 변환에 실패했어요"))),
      "image/jpeg",
      0.85
    )
  );
}

export async function uploadPhoto(key: string, dateId: string, blob: Blob, sort: number) {
  const path = `${key}/${crypto.randomUUID()}.jpg`;

  const { error: upErr } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(path, blob, { contentType: "image/jpeg" });
  if (upErr) throw upErr;

  const { error: insErr } = await supabase
    .from("date_photos")
    .insert({ date_id: dateId, path, sort });
  if (insErr) throw insErr;

  return path;
}
