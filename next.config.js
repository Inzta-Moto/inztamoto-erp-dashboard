/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Server routes under /api/marketplace use the Firebase Admin SDK; keep it out of the webpack bundle.
    serverComponentsExternalPackages: ["firebase-admin"],
  },
};
module.exports = nextConfig;
