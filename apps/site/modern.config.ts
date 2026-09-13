import { appTools, defineConfig } from "@modern-js/app-tools";

// site 默认 8082(server 8080 / admin 8081 已占用,见 docs/quality-and-site-plan.md 阶段 17)。
const devServerPort = process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 8082;

// dev 代理 /api → Go server(e2e 起独立端口的服务端时用 API_PROXY_TARGET 覆盖)。
// 契约路径字面带 /api/site 前缀,开发态原样透传(见 docs/multi-audience-contracts.md)。
const apiProxyTarget = process.env.API_PROXY_TARGET ?? "http://localhost:8080";

export default defineConfig({
  html: {
    title: "CMS Template"
  },
  server: {
    port: devServerPort,
    // SSR 开启后路由模块的 loader(page.data.ts / layout.data.ts)在服务端执行,
    // 数据随 HTML 下发,客户端 hydration 复用(见 docs/site.md「SSR 注意事项」)。
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
