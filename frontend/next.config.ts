import path from 'path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
    output: process.env.NODE_ENV === 'production' ? 'standalone' : undefined,
    // Tells Next.js where the workspace root is so it can trace hoisted node_modules
    outputFileTracingRoot: path.join(__dirname, '../'),
    turbopack: {
        root: path.join(__dirname, '../')
    }
};

export default nextConfig;
