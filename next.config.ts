import type { NextConfig } from "next";

// Worktree žije uvnitř jiného repa s vlastním lockfile — bez explicitního
// rootu Next špatně uhodne workspace root a standalone build je nekompletní.
const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: import.meta.dirname,
  turbopack: { root: import.meta.dirname },
};

export default nextConfig;
