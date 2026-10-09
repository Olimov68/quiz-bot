/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@smart-quiz/shared'],
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:4000/api/:path*',
      },
      {
        source: '/media/:path*',
        destination: 'http://localhost:4000/media/:path*',
      },
    ];
  },
};

export default nextConfig;
