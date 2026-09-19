import { appTools, defineConfig } from "@modern-js/app-tools";

// h5 默认 18082(site 8082 / admin 8081 / server 8080 已占用,见 docs/monorepo-expansion-plan.md 阶段 3)。
const devServerPort = process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 18082;

// dev 代理 /api → Go server(h5 受众链,18085;e2e 起独立端口的服务端时用 API_PROXY_TARGET 覆盖)。
// 契约路径字面带 /api/h5 前缀,开发态原样透传(见 docs/multi-audience-contracts.md)。
const apiProxyTarget = process.env.API_PROXY_TARGET ?? "http://127.0.0.1:18085";

// 生产构建注入 CSP meta(XSS 防御,仅生产注入:dev 的 HMR/内联脚本会被 CSP 破坏,
// 与 site 同策略)。SSR 会内联 loader 数据 script,严格 'self' 会拦内联 script,起步
// 放开 'unsafe-inline';TODO:nonce 化后收紧。托管层响应头 CSP 为权威配置。
const productionCSP = [
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  "connect-src 'self'"
].join("; ");

const productionCSPMeta = {
  "Content-Security-Policy": {
    "http-equiv": "Content-Security-Policy",
    content: productionCSP
  }
};

export default defineConfig({
  html: {
    title: "CMS Template H5",
    ...(process.env.NODE_ENV === "production" ? { meta: productionCSPMeta } : {})
  },
  server: {
    port: devServerPort,
    // SSR 开启后路由模块的 loader(page.data.ts)在服务端执行,数据随 HTML 下发,
    // 客户端 hydration 复用(与 site 同范式,见 docs/site.md「SSR 注意事项」)。
    ssr: true
  },
  dev: {
    server: {
      proxy: {
        "/api": {
          target: apiProxyTarget,
          changeOrigin: true
        }
      }
    }
  },
  plugins: [appTools()]
});
