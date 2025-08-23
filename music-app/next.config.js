/** @type {import('next').NextConfig} */
const nextConfig = {
  swcMinify: false,
  experimental: {
    esmExternals: false,
  },
}

module.exports = nextConfig