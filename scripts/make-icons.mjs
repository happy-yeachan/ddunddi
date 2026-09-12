// 아이콘·스플래시 PNG 생성. `npm run icons`
//
// 이모지를 SVG <text>로 올리는 방법은 쓰지 않는다. sharp의 SVG 렌더러가
// 컬러 이모지 폰트를 지원하지 않아 검은 실루엣으로 래스터화되고,
// 결과가 머신의 설치 폰트에 좌우된다. 패스로 직접 그리면 어디서 돌려도 같다.
import sharp from "sharp";
import { mkdir, readFile } from "node:fs/promises";

const BRAND = "#ff8fab";
const CREAM = "#fff7f9";

// 24x24 뷰박스 기준 하트. 실제 범위는 x 2~22, y 3~21.4 이라 중심이 (12, 12.2).
const HEART =
  "M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 " +
  "3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 " +
  "3.78-3.4 6.86-8.55 11.54L12 21.35z";

// scale은 캔버스 대비 하트가 차지하는 비율. 아이콘은 0.72로, maskable
// 안전영역(중앙 80% 원) 안에 넉넉히 들어간다.
const heartSvg = (size, bg, fg, scale) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24">
<rect width="24" height="24" fill="${bg}"/>
<path d="${HEART}" fill="${fg}" transform="translate(12 12.2) scale(${scale}) translate(-12 -12.2)"/>
</svg>`;

const splashSvg = (w, h) => {
  const s = Math.min(w, h) * 0.22;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
<rect width="${w}" height="${h}" fill="${CREAM}"/>
<svg x="${(w - s) / 2}" y="${(h - s) / 2}" width="${s}" height="${s}" viewBox="0 0 24 24">
<path d="${HEART}" fill="${BRAND}"/>
</svg>
</svg>`;
};

// iOS는 media 쿼리가 기기와 정확히 맞아야 스플래시를 띄운다. 기기 목록은
// app/layout.tsx의 <link> 태그와 같은 파일을 읽어 서로 어긋나지 않게 한다.
const DEVICES = JSON.parse(
  await readFile(new URL("../lib/splash-devices.json", import.meta.url), "utf8")
);

const png = (svg, out) => sharp(Buffer.from(svg)).png().toFile(out);

await mkdir("public/splash", { recursive: true });

await Promise.all([
  png(heartSvg(192, BRAND, "#ffffff", 0.72), "public/icon-192.png"),
  png(heartSvg(512, BRAND, "#ffffff", 0.72), "public/icon-512.png"),
  // iOS 홈 화면 아이콘은 투명도를 검게 칠하므로 배경을 반드시 채운다.
  png(heartSvg(180, BRAND, "#ffffff", 0.72), "public/apple-touch-icon.png"),
  png(heartSvg(32, BRAND, "#ffffff", 0.8), "public/favicon.png"),
  ...DEVICES.map(({ w, h, r }) =>
    png(splashSvg(w * r, h * r), `public/splash/${w}x${h}@${r}x.png`)
  ),
]);

console.log(`아이콘 4개 + 스플래시 ${DEVICES.length}개 생성 완료`);
