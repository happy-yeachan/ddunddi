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
  const { source, width, height, release } = await decode(file);
  try {
    const scale = Math.min(1, maxEdge / Math.max(width, height));
    const w = Math.max(1, Math.round(width * scale));
    const h = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("캔버스를 만들 수 없어요");
    ctx.drawImage(source, 0, 0, w, h);

    return await new Promise((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error(`${file.name} 변환에 실패했어요`))),
        "image/jpeg",
        0.85
      )
    );
  } finally {
    release();
  }
}

type Decoded = {
  source: CanvasImageSource;
  width: number;
  height: number;
  release: () => void;
};

// 디코딩 경로를 세 단계로 두고 순서대로 떨어진다.
// createImageBitmap 은 빠르지만 iOS Safari 가 옵션 인자를 거부하며 던지는
// 경우가 있어 옵션 없이 한 번 더 시도하고, 그것도 실패하면 <img> 로 간다.
// <img> 는 브라우저가 EXIF 회전을 알아서 적용하므로 사진이 눕지 않는다.
async function decode(file: File): Promise<Decoded> {
  for (const opts of [{ imageOrientation: "from-image" } as const, undefined]) {
    try {
      const bitmap = opts
        ? await createImageBitmap(file, opts)
        : await createImageBitmap(file);
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        release: () => bitmap.close(),
      };
    } catch {
      // 다음 경로로
    }
  }

  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return {
      source: img,
      width: img.naturalWidth,
      height: img.naturalHeight,
      release: () => URL.revokeObjectURL(url),
    };
  } catch {
    URL.revokeObjectURL(url);
    throw new Error(
      `${file.name} 을(를) 읽지 못했어요. 아이폰 HEIC 사진이면 설정에서 "높은 호환성"으로 찍거나 JPEG 로 바꿔서 올려주세요`
    );
  }
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
