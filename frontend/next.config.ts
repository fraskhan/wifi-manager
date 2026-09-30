import type { NextConfig } from "next";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:4000";

const nextConfig: NextConfig = {
  async rewrites() {
    // Same-origin proxy to the Express API: /api/* -> backend /api/*
    // Keeps auth cookies first-party; no CORS in the browser.
    return [{ source: "/api/:path*", destination: `${BACKEND_URL}/api/:path*` }];
  },
};

export default nextConfig;
