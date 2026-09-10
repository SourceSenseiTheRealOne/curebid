import { defineConfig } from "@playwright/test";
export default defineConfig({ testDir: "./tests/browser", timeout: 45000, workers: 1, use: { baseURL: process.env.E2E_BASE_URL ?? "http://127.0.0.1:4310", screenshot: "only-on-failure", trace: "retain-on-failure" }, reporter: [["list"]] });
