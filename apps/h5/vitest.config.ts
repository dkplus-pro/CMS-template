import { defineConfig } from "vitest/config";

// h5 单元测试配置(照抄 site,与 admin 同构):
// 默认 jsdom 环境覆盖组件用例;纯逻辑/SSR 分支用例用 `// @vitest-environment node` docblock 覆盖。
export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.{ts,tsx}"]
  }
});
