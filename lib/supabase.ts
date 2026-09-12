import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 가 설정되지 않았습니다. " +
      ".env.local 과 Vercel 환경변수를 확인하세요."
  );
}

// RLS 를 끈 상태라 anon key 하나로 읽고 쓴다. supabase/schema.sql 의 주석 참고.
export const supabase = createClient(url, anonKey);

export const PHOTO_BUCKET = "date-photos";

export function photoUrl(path: string) {
  return supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl;
}
