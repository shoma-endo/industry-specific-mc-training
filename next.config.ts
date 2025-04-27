import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    domains: ['profile.line-scdn.net', 'cdn.sanity.io'],
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  output: 'export',
};

export default nextConfig;
