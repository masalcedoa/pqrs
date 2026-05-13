/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: { serverActions: { allowedOrigins: ['*'] } },
  images: { remotePatterns: [{ protocol: 'https', hostname: '**.supabase.co' }] }
};
export default nextConfig;
