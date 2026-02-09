import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@acolyte/shared', '@acolyte/ui-tokens', '@acolyte/api-client'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.r2.cloudflarestorage.com',
      },
    ],
  },
};

export default nextConfig;
