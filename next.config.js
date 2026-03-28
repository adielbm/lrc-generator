/** @type {import('next').NextConfig} */
const repoName = 'lrc-generator';

const nextConfig = {
  reactStrictMode: true,
  output: 'export',
  trailingSlash: true,
  basePath: `/${repoName}`,
  assetPrefix: `/${repoName}/`,
  env: {
    NEXT_PUBLIC_APP_VERSION: process.env.npm_package_version || 'dev',
  },
}

module.exports = nextConfig
  