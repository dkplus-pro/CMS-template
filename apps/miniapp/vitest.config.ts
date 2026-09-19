import { defineConfig } from "vitest/config";

// miniapp 单测只覆盖纯逻辑(信封解包等),不渲染 Taro 小程序组件(小程序组件在 jsdom 不可渲染),
// 因此用 node 环境即可,无需 jsdom 与 setup 文件。
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.{ts,tsx}"]
  }
});
