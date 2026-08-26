import { defineConfig } from '@playwright/test';

const PORT = 3100;

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: 0,
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'off',
  },
  webServer: {
    // standalone output: spustíme server.js přímo se zkopírovanými statickými soubory
    command: `pnpm build && cp -r .next/static .next/standalone/.next/static && HOSTNAME=127.0.0.1 PORT=${PORT} node .next/standalone/server.js`,
    port: PORT,
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      DATABASE_URL: 'postgresql://qr4life:qr4life@localhost:5432/qr4life',
      NEXT_PUBLIC_APP_URL: `http://localhost:${PORT}`,
      SESSION_SECRET: 'e2e-only-session-secret',
      SMTP_HOST: '',
      NODE_ENV: 'production',
    },
  },
});
