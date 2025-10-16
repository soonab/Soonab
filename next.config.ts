// next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true, // skip ESLint during Vercel / prod builds
  },
};

export default nextConfig;
