import { defineConfig } from "vitest/config";

// desktop 冒烟测试只覆盖纯逻辑(信封解包等),不启动 electron、不渲染组件,node 环境即可。
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.{ts,tsx}"]
  }
});
