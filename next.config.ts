import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  basePath: "/personal-planner",
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
