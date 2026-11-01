import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: '**/*.spec.mjs',
  timeout: 60000,
  expect: { timeout: 30000 },
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173/k1ii-qr/',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], channel: process.env.BROWSER_CHANNEL || undefined, viewport: { width: 1200, height: 900 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'], channel: process.env.BROWSER_CHANNEL || undefined } },
  ],
  webServer: {
    command: 'node serve.mjs',
    url: 'http://127.0.0.1:4173/k1ii-qr/',
    reuseExistingServer: false,
    timeout: 10000,
  },
});
