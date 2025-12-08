/** @type {import('next').NextConfig} */
const path = require('path');

const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['hazo_llm_api'],
  // Mark sql.js as external for server components
  experimental: {
    serverComponentsExternalPackages: ['sql.js'],
  },
  webpack: (config, { isServer }) => {
    // Add aliases for hazo_llm_api package (since it's not published to npm)
    // Point to the dist directory, not individual files
    config.resolve.alias = {
      ...config.resolve.alias,
      'hazo_llm_api$': path.resolve(__dirname, '../dist/index.js'),
      'hazo_llm_api/server$': path.resolve(__dirname, '../dist/server.js'),
    };
    
    // Handle sql.js - externalize for server
    if (isServer) {
      config.externals = [...(config.externals || []), 'sql.js'];
    }
    
    return config;
  },
}

module.exports = nextConfig
