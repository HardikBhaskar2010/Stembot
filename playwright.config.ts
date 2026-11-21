import { defineConfig, devices } from '@playwright/test';

/** Smoke tests run against the production build (CSP on, service worker on) with MockTransport. */
export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4174',
    trace: 'retain-on-failure',
    serviceWorkers: 'block',
  },
  projects: [
    {
      name: 'mobile',
      use: {
        ...devices['Pixel 7'],
        browserName: 'chromium',
        viewport: { width: 390, height: 844 },
      },
    },
    {
      name: 'desktop',
      use: { browserName: 'chromium', viewport: { width: 1440, height: 900 } },
    },
  ],
  webServer: {
    command: 'npx vite preview --port 4174 --strictPort',
    port: 4174,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
