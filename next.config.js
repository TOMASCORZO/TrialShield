/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    experimental: {
        serverComponentsExternalPackages: [],
    },
    // CORS is handled in src/middleware.ts so it can be scoped per-route
    // (dashboard endpoints are restricted, public endpoints stay open).
};

module.exports = nextConfig;
