import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: "*.spec.ts",
  workers: 1,
  timeout: 75000,
  expect: { timeout: 12000 },
  use: { channel: process.env.PLAYWRIGHT_CHANNEL, trace: "retain-on-failure" },
  globalSetup: "./tests/servers.ts",
});
