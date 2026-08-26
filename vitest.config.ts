import path from 'node:path';
import { defineConfig } from 'vitest/config';

// Lokální testovací DB, pokud nic není nastaveno (CI/devbox).
process.env.DATABASE_URL ??= 'postgresql://qr4life:qr4life@localhost:5432/qr4life';
process.env.SESSION_SECRET ??= 'test-only-session-secret';

export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, 'src') },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    testTimeout: 15000,
    // DB testy sdílí jednu databázi — paralelní reset by si mazal data.
    fileParallelism: false,
  },
});
