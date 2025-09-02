import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    domains: ['profile.line-scdn.net'],
  },
  typescript: {
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
