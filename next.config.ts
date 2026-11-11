import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PoC: 挂在 /porsche-home 子路径下（nginx 无尾斜杠反代，应用自行识别前缀）
  basePath: "/porsche-home",
};

export default nextConfig;
