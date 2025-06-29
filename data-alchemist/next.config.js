/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
};

console.log('✅ next.config.js loaded — ESLint will be skipped');

module.exports = nextConfig;
