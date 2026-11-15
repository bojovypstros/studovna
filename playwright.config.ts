import { defineConfig, devices } from "@playwright/test";

const databaseUrl = "postgresql://studovna:studovna@127.0.0.1:5432/studovna_e2e";

export default defineConfig({
  testDir: "tests",
  testMatch: "**/*.spec.ts",
  globalSetup: "./tests/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://127.0.0.1:3000",
  },
  webServer: {
    command: "pnpm exec next dev --hostname 127.0.0.1 --port 3000",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
      SMTP_HOST: "capture",
      SMTP_PORT: "587",
      SMTP_USER: "smtp-login@combatostrich.dev",
      SMTP_PASSWORD: "not-a-real-password",
      SMTP_AUTH: "true",
      MAIL_FROM: "Studovna <edu@combatostrich.dev>",
      APP_URL: "http://127.0.0.1:3000",
      STORAGE_DIR: "./tmp/storage-e2e",
    },
  },
});
