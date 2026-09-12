import { PHOTO_BUCKET, supabase } from "./supabase";
import type { PersonId } from "./me";

export type Profile = {
  id: string;
  author: PersonId;
  subject: PersonId;
  photo_path: string | null;
  name: string;
  birth_date: string;
  personality: string;
  likes: string;
  dislikes: string;
  intro: string;
};

export async function loadProfile(author: PersonId, subject: PersonId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, author, subject, photo_path, name, birth_date, personality, likes, dislikes, intro")
    .eq("author", author)
    .eq("subject", subject)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as Profile | null;
}

export async function saveProfile(profile: Omit<Profile, "id"> & { id?: string }) {
  const payload = { ...profile, birth_date: profile.birth_date || null };
  const { data, error } = await supabase
    .from("profiles")
    .upsert(payload, { onConflict: "author,subject" })
    .select("id, author, subject, photo_path, name, birth_date, personality, likes, dislikes, intro")
    .single();
  if (error) throw error;
  return data as Profile;
}

export async function uploadProfilePhoto(author: PersonId, subject: PersonId, file: File) {
  const path = `profiles/${author}/${subject}-${crypto.randomUUID()}.${file.name.split(".").pop() || "jpg"}`;
  const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, file, {
    contentType: file.type || "image/jpeg",
    upsert: false,
  });
  if (error) throw error;
  return path;
}
