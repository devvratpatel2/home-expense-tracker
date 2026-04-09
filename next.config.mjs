/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    config.resolve.fallback = { ...config.resolve.fallback, fs: false, path: false };
    return config;
  },
  experimental: {
    serverComponentsExternalPackages: ['sql.js'],
  },
};

export default nextConfig;
