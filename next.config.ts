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
    // Next nemá per-route variantu téhle volby, takže tenhle strop platí
    // pro VŠECHNY /api/* route, ne jen pro upload zvuku — je to jen horní
    // hranice pro klonování v middlewaru. Za svůj vlastní (nižší) limit
    // velikosti si zodpovídá každá mutující route sama (viz např.
    // MAX_UPLOAD_REQUEST_BYTES v src/lib/audio/sniff.ts).
    middlewareClientMaxBodySize: "20mb",
  },
};

export default nextConfig;
