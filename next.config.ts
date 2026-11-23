import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Don't let `next dev` rewrite AGENTS.md on every launch; the project keeps its own instructions.
  agentRules: false,
  // This folder is the project root, even if a stray package-lock.json sits in a parent folder.
  turbopack: { root: __dirname },
};

export default nextConfig;
