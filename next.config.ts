import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Don't let `next dev` rewrite AGENTS.md on every launch; the project keeps its own instructions.
  agentRules: false,
};

export default nextConfig;
