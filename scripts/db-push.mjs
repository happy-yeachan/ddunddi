// supabase/schema.sql 을 DB 에 그대로 적용한다. `npm run db:push`
//
// schema.sql 은 여러 번 실행해도 안전하게 써두었으므로, 누가 테이블을
// 추가하든 그 파일에만 적고 이 명령을 돌리면 된다. 콘솔에 SQL 을 복사해
// 붙이는 과정에서 설명 문장이 섞여 들어가는 사고를 막는다.
import { readFile } from "node:fs/promises";
import pg from "pg";

const url = process.env.SUPABASE_DB_URL;
if (!url) {
  console.error(
    "SUPABASE_DB_URL 이 없습니다.\n" +
      "Supabase → Project Settings → Database → Connection string → Session pooler 의\n" +
      "문자열을 .env.local 에 직접 넣으세요. Vercel 에는 넣지 않습니다 (런타임에 쓰지 않음)."
  );
  process.exit(1);
}

// Direct connection 은 IPv6 전용이라 대개 연결되지 않는다. 호스트만 보고
// 미리 걸러 준다. 에러 메시지만으로는 원인을 알아보기 어렵다.
if (!/pooler\.supabase\.com/.test(url)) {
  console.error(
    "SUPABASE_DB_URL 이 Direct connection 입니다. Session pooler 문자열로 바꾸세요.\n" +
      "  Direct        db.<ref>.supabase.co:5432        사용자 postgres\n" +
      "  Session pooler aws-....pooler.supabase.com:5432 사용자 postgres.<ref>\n" +
      "Supabase → 상단 Connect → Connection String → Session pooler"
  );
  process.exit(1);
}

// 연결 문자열의 자리표시자를 지우지 않고 그대로 붙여넣는 일이 잦다.
// 그대로 두면 "password authentication failed" 만 나와 원인을 알기 어렵다.
if (/\[|YOUR-PASSWORD|<password>/i.test(url)) {
  console.error(
    "SUPABASE_DB_URL 의 비밀번호 자리가 아직 자리표시자입니다.\n" +
      "[YOUR-PASSWORD] 를 대괄호까지 지우고 실제 DB 비밀번호로 바꾸세요.\n" +
      "비밀번호를 모르면 Supabase → Database → Settings → Reset password 로 새로 정하면 됩니다."
  );
  process.exit(1);
}

const sql = await readFile(new URL("../supabase/schema.sql", import.meta.url), "utf8");

const client = new pg.Client({
  connectionString: url,
  // Supabase 는 자체 CA 를 쓴다. 로컬에서 도는 개발용 스크립트라 검증은 생략한다.
  ssl: { rejectUnauthorized: false },
});

await client.connect();
try {
  // 전체를 한 트랜잭션으로 돌린다. 중간에 실패하면 아무것도 남기지 않는다.
  await client.query("begin");
  await client.query(sql);
  await client.query("commit");
  console.log("schema.sql 적용 완료");

  const { rows } = await client.query(`
    select table_name,
           (select count(*) from pg_policies p where p.tablename = t.table_name) as policies
    from information_schema.tables t
    where table_schema = 'public' and table_type = 'BASE TABLE'
    order by table_name
  `);
  console.log("\n현재 테이블:");
  for (const r of rows) console.log(`  ${r.table_name} (정책 ${r.policies}개)`);
} catch (e) {
  await client.query("rollback").catch(() => {});
  console.error("적용 실패 — 아무것도 바뀌지 않았습니다.\n", e.message);
  if (e.code === "EHOSTUNREACH" || e.code === "ENETUNREACH") {
    console.error("연결 자체가 안 됩니다. Session pooler 문자열인지 다시 확인하세요.");
  }
  process.exitCode = 1;
} finally {
  await client.end();
}
