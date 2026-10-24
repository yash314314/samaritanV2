import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  output: "export",
  assetPrefix: "./",
  // The repo root has its own lockfile; build from this package, not from there.
  turbopack: { root: __dirname },
};

export default nextConfig;
