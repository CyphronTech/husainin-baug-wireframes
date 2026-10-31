import type { NextConfig } from "next";

const config: NextConfig = {
  // Expense bills (PDF/photo) are uploaded through a server action; default limit is 1 MB.
  experimental: { serverActions: { bodySizeLimit: "10mb" } },
  poweredByHeader: false,
  headers: () => [
    {
      source: "/:path*",
      headers: [
        { key: "X-Frame-Options", value: "DENY" }, // no embedding in other sites (clickjacking)
        { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
      ],
    },
  ],
};

export default config;
