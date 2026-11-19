import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";

const config: NextConfig = {
  poweredByHeader: false,
  turbopack: { root: fileURLToPath(new URL(".", import.meta.url)) },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'" },
        ],
      },
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache" }] },
      { source: "/admin/:path*", headers: [{ key: "Cache-Control", value: "private, no-store" }, { key: "X-Robots-Tag", value: "noindex" }] },
    ];
  },
};

export default config;
