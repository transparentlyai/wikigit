/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',

  env: {
    NEXT_PUBLIC_APP_VERSION: process.env.npm_package_version,
  },

  // Proxy API requests to FastAPI backend
  async rewrites() {
    const backendPort = process.env.BACKEND_PORT || '9009'
    return [
      {
        source: '/api/:path*',
        destination: `http://localhost:${backendPort}/:path*`,
      },
      {
        source: '/media/:path*',
        destination: `http://localhost:${backendPort}/media/:path*`,
      },
    ]
  },

  // Forward GCP IAP headers
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'X-Forwarded-Host',
            value: 'localhost',
          },
        ],
      },
    ]
  },
}

module.exports = nextConfig
