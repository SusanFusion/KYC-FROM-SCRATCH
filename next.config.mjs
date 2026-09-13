/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    // Linting is run separately in CI; don't fail the production build on lint warnings.
    ignoreDuringBuilds: false,
  },
  experimental: {
    // pdfjs-dist (used server-side for PDF text extraction) and its
    // optional @napi-rs/canvas dependency (which supplies the DOMMatrix /
    // Path2D / ImageData globals Node doesn't have) both ship native
    // Node-specific code paths — Next's bundler must leave them as real
    // require()/import() calls resolved at runtime, not try to statically
    // bundle them, or the native binary can't be found in production.
    serverComponentsExternalPackages: ["pdfjs-dist", "@napi-rs/canvas"],
  },
};

export default nextConfig;
