import type { NextConfig } from "next";

console.log('✅ next.config.ts loaded');
const nextConfig: NextConfig = {
  /* config options here */
  eslint: {
    ignoreDuringBuilds: true, // ✅ disables ESLint during `next build`
  },
};

export default nextConfig;
``