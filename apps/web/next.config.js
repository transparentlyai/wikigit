/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',

  // Proxy API requests to FastAPI backend
  async rewrites() {
    const backendPort = process.env.BACKEND_PORT || '8000'
    return [
      {
        source: '/api/:path*',
        destination: `http://localhost:${backendPort}/:path*`,
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
