/** @type {import('next').NextConfig} */
const nextConfig = {
  // swcMinify: true, // Re-enable to test
  experimental: {
    esmExternals: false,
  },
};

module.exports = nextConfig;