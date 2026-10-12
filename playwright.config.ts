import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/ui', timeout: 30000, fullyParallel: true,
  use: { baseURL: 'http://127.0.0.1:5173', viewport: { width: 1440, height: 960 }, launchOptions: process.env.PANDORA_CHROMIUM ? { executablePath: process.env.PANDORA_CHROMIUM } : undefined, screenshot: 'only-on-failure' },
  webServer: { command: 'npm run dev:web -- --host 127.0.0.1', url: 'http://127.0.0.1:5173', reuseExistingServer: !process.env.CI, timeout: 30000 }
});
