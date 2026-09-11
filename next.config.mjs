/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    // Linting is run separately in CI; don't fail the production build on lint warnings.
    ignoreDuringBuilds: false,
  },
};

export default nextConfig;
