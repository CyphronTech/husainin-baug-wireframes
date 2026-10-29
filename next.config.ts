import type { NextConfig } from "next";

const config: NextConfig = {
  // Expense bills (PDF/photo) are uploaded through a server action; default limit is 1 MB.
  experimental: { serverActions: { bodySizeLimit: "10mb" } },
};

export default config;
