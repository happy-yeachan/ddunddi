import type { Metadata, Viewport } from "next";
import splashDevices from "@/lib/splash-devices.json";
import "./globals.css";

export const metadata: Metadata = {
  title: "뚠띠뚠띠",
  description: "예찬과 다은의 기록",
  applicationName: "뚠띠뚠띠",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "뚠띠뚠띠",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/favicon.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
  },
  other: {
    // Next 16의 appleWebApp.capable은 표준 후속인 mobile-web-app-capable만
    // 내보낸다. 구형 iOS는 여전히 apple- 접두 태그를 봐서 직접 넣는다.
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: "#ff8fab",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <head>
        {/* iOS 스플래시. media가 기기와 정확히 맞아야 적용되므로 해상도별로 건다. */}
        {splashDevices.map(({ w, h, r }) => (
          <link
            key={`${w}x${h}@${r}x`}
            rel="apple-touch-startup-image"
            href={`/splash/${w}x${h}@${r}x.png`}
            media={`(device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${r}) and (orientation: portrait)`}
          />
        ))}
      </head>
      <body>{children}</body>
    </html>
  );
}
