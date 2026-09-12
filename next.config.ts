import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Supabase Storage 의 public URL. 프로젝트가 바뀌면 여기 호스트도 같이 바꿔야 한다.
      {
        protocol: "https",
        hostname: "xvcqywysqpltzwpipgfx.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
