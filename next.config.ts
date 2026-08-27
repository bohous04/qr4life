import type { NextConfig } from "next";

// Worktree žije uvnitř jiného repa s vlastním lockfile — bez explicitního
// rootu Next špatně uhodne workspace root a standalone build je nekompletní.
const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: import.meta.dirname,
  turbopack: { root: import.meta.dirname },
  experimental: {
    // Middleware běží na /api/:path* (CSRF), takže Next tělo požadavku
    // klonuje pro předání dál — s výchozím limitem 10 MB by nahrávky
    // zvuku (limit 15 MB, viz src/lib/audio/sniff.ts) byly nachlup
    // uřezané ještě před tím, než je uvidí náš vlastní streamovaný limit.
    middlewareClientMaxBodySize: "20mb",
  },
};

export default nextConfig;
