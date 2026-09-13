import { defineConfig, devices } from "@playwright/test";

// e2e 起独立端口的 server(18085)与 admin(18080)、site(18081)。
const E2E_SERVER_PORT = 18085;
const E2E_SITE_PORT = 18081;

export default defineConfig({
  testDir: "./tests/playwright",
  timeout: 30_000,
  expect: {
    timeout: 5_000
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL: "http://127.0.0.1:18080",
    trace: "on-first-retry"
  },
  webServer: [
    {
      // STORAGE_DRIVER=local 钉死本地存储,避免本地 .env.local(driver=cos)让 e2e 依赖外网
      // CSRF_ALLOWED_ORIGINS: e2e 的 admin 起在 127.0.0.1:18080,浏览器 Origin 不在服务端
      // 默认白名单(localhost:8081)里,须显式放行(见 docs/server.md "CSRF 与会话安全")。
      command: `rm -f /tmp/cms-e2e.db && SERVER_PORT=${E2E_SERVER_PORT} DATABASE_DSN=/tmp/cms-e2e.db SWAGGER_ENABLED=false STORAGE_DRIVER=local STORAGE_BASE_PATH=/tmp/cms-e2e-files CSRF_ALLOWED_ORIGINS=http://127.0.0.1:18080 go run ./cmd/server`,
      cwd: "./apps/server",
      url: `http://127.0.0.1:${E2E_SERVER_PORT}/api/admin/healthz`,
      reuseExistingServer: false,
      timeout: 120_000
    },
    {
      command: `PORT=18080 API_PROXY_TARGET=http://127.0.0.1:${E2E_SERVER_PORT} pnpm --filter @monorepo-template/admin run dev`,
      url: "http://127.0.0.1:18080",
      reuseExistingServer: false,
      timeout: 120_000
    },
    {
      // site 的 SSR 数据不经过 dev 代理,直接按 SITE_API_BASE 打 Go server(见 docs/site.md)。
      command: `PORT=${E2E_SITE_PORT} API_PROXY_TARGET=http://127.0.0.1:${E2E_SERVER_PORT} SITE_API_BASE=http://127.0.0.1:${E2E_SERVER_PORT} pnpm --filter @monorepo-template/site run dev`,
      url: `http://127.0.0.1:${E2E_SITE_PORT}`,
      reuseExistingServer: false,
      timeout: 120_000
    }
  ],
  projects: [
    {
      name: "chromium",
      testIgnore: /site-app\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] }
    },
    {
      // site 用例:baseURL 指向 site dev(18081),后端复用同一 e2e server(18085)。
      name: "site",
      testMatch: /site-app\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], baseURL: `http://127.0.0.1:${E2E_SITE_PORT}` }
    }
  ]
});
