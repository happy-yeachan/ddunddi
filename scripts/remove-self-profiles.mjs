import pg from "pg";
import { readFile } from "node:fs/promises";

const client = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15000 });
try {
  if (!process.env.SUPABASE_DB_URL) throw new Error("SUPABASE_DB_URL이 없습니다.");
  await client.connect();
  await client.query("begin");
  await client.query("lock table public.profiles in share row exclusive mode");
  const before = await client.query("select count(*) filter (where author = subject)::int as self, count(*) filter (where author <> subject)::int as partner from public.profiles");
  await client.query(await readFile(new URL("../supabase/remove-self-profiles.sql", import.meta.url), "utf8"));
  const after = await client.query("select count(*) filter (where author = subject)::int as self, count(*) filter (where author <> subject)::int as partner from public.profiles");
  if (after.rows[0].self !== 0 || after.rows[0].partner !== before.rows[0].partner) throw new Error("삭제 범위 검증 실패");
  await client.query("commit");
  console.log(`자기소개 ${before.rows[0].self}개 삭제. 상대 소개 ${after.rows[0].partner}개 보존. 남은 자기소개 0개.`);
} catch (error) {
  await client.query("rollback").catch(() => {});
  console.error(error.message);
  process.exitCode = 1;
} finally { await client.end().catch(() => {}); }
