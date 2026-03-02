import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright Test Configuration
 *
 * Uses system-installed Chrome to avoid downloading additional browsers.
 * Run tests with: npm run test:e2e
 */

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",

  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  /* Use system Chrome instead of downloading Playwright browsers */
  projects: [
    {
      name: "chrome",
      use: {
        ...devices["Desktop Chrome"],
        channel: "chrome", // Use system-installed Chrome
      },
    },
    // Uncomment these if you have these browsers installed and want to test on them
    // {
    //   name: "firefox",
    //   use: { ...devices["Desktop Firefox"] },
    // },
    // {
    //   name: "msedge",
    //   use: { ...devices["Desktop Edge"], channel: "msedge" },
    // },
  ],

  /* Run local dev server before starting the tests */
  webServer: {
    command: "npm run dev:web",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
