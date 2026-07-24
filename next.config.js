/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    tsconfigPath: "tsconfig.next.json",
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;
