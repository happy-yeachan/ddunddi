// 한 번 생성한 VAPID 키를 암호화해 저장한다. 비밀 값은 출력하지 않는다.
import pg from "pg";
import webpush from "web-push";
import { createHash, createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

if (!process.env.GATE_PASSWORD || !process.env.SUPABASE_DB_URL) throw new Error("GATE_PASSWORD와 SUPABASE_DB_URL이 필요합니다.");
const key = createHash("sha256").update(`ddunddi-push-encryption:${process.env.GATE_PASSWORD}`).digest();
const db = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
try {
  await db.connect();
  const { rows } = await db.query("select payload from public.push_config where id = 'vapid'");
  if (rows.length) {
    const bytes = Buffer.from(rows[0].payload, "base64url");
    const cipher = createDecipheriv("aes-256-gcm", key, bytes.subarray(0, 12));
    cipher.setAuthTag(bytes.subarray(12, 28));
    cipher.update(bytes.subarray(28)); cipher.final();
    console.log("기존 푸시 키 확인 완료. 키를 변경하지 않았습니다.");
  } else {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const encrypted = Buffer.concat([cipher.update(JSON.stringify(webpush.generateVAPIDKeys()), "utf8"), cipher.final()]);
    const payload = Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64url");
    await db.query("insert into public.push_config (id, payload) values ('vapid', $1) on conflict (id) do nothing", [payload]);
    console.log("푸시 키 생성 및 암호화 저장 완료.");
  }
} catch { console.error("푸시 설정 실패. DB 연결, 스키마 및 기존 GATE_PASSWORD 일치 여부를 확인해주세요."); process.exitCode = 1; }
finally { await db.end().catch(() => {}); }
