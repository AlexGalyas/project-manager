import type { NextConfig } from 'next';
import path from 'node:path';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@workforce/shared'],
  sassOptions: {
    includePaths: [path.join(process.cwd(), 'src/styles')],
  },
};

export default nextConfig;
