import type { NextConfig } from "next";

const isProduction = process.env.NODE_ENV === "production";

const securityHeaders = [
  // Restrict embedding of the app to prevent clickjacking.
  { key: "X-Frame-Options", value: "DENY" },
  // Hardened MIME sniffing protection.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Never leak the referring path (and any query params) to third parties.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Opt out of browser features we do not use, reducing attack surface.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
  // Only enforce HSTS on https in production; never in local dev over http.
  ...(isProduction
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
      ]
    : []),
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  serverExternalPackages: [],
  ...(process.env.NODE_ENV === "development"
    ? { allowedDevOrigins: ["127.0.0.1", "host.docker.internal"] }
    : {}),
  async headers() {
    return [
      {
        // The strict CSP is NOT emitted from here: it must be generated per
        // request (fresh nonce) so Next.js inline bootstrap scripts and the
        // Supabase origin survive. It is applied in proxy.ts at the middleware
        // layer in production. These static headers keep X-Frame-Options +
        // feature opt-outs enforced app-wide on every response.
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
