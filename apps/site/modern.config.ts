import { appTools, defineConfig } from "@modern-js/app-tools";

// site 默认 8082(server 8080 / admin 8081 已占用,见 docs/quality-and-site-plan.md 阶段 17)。
const devServerPort = process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 8082;

// dev 代理 /api → Go server(e2e 起独立端口的服务端时用 API_PROXY_TARGET 覆盖)。
// 契约路径字面带 /api/site 前缀,开发态原样透传(见 docs/multi-audience-contracts.md)。
const apiProxyTarget = process.env.API_PROXY_TARGET ?? "http://localhost:8080";

// 生产构建注入 CSP meta(XSS 防御,仅生产注入:dev 的 HMR/内联脚本会被 CSP 破坏,
// 与 admin 同策略,见 docs/site.md「安全」)。SSR 会内联 loader 数据 script,严格
// 'self' 会拦内联 script,起步放开 'unsafe-inline';TODO:nonce 化后收紧。
// 注意:接入 RUM 后需把 RUM_ENDPOINT 域名加入 connect-src(当前 connect-src 'self' 为
// 公开只读站点的起步配置,上线时随 RUM 部署一并评审)。托管层响应头 CSP 为权威配置。
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

// RUM 配置构建期内联:客户端 bundle 不存在 Node 的 process,裸 process.env 引用会
// ReferenceError(实测踩过),因此把 process.env.RUM_* 显式内联为字面量;
// 未配置时内联为空串,readRumConfig 判空即不初始化(dev 默认关闭,见 docs/site.md「监控」)。
// 构建期内联意味着部署时 RUM_ENDPOINT/RUM_PID 需在构建(CI)阶段注入,而非仅运行时。
const rumDefine = {
  "process.env.RUM_PID": JSON.stringify(process.env.RUM_PID ?? ""),
  "process.env.RUM_ENDPOINT": JSON.stringify(process.env.RUM_ENDPOINT ?? "")
};

export default defineConfig({
  source: {
    define: rumDefine
  },
  html: {
    title: "CMS Template",
    ...(process.env.NODE_ENV === "production" ? { meta: productionCSPMeta } : {})
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
