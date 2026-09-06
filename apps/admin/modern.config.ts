import { appTools, defineConfig } from "@modern-js/app-tools";

// admin 默认 8081,8080 留给 Go server(PORT 仍可覆盖,e2e 用它换端口)。
const devServerPort = process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 8081;

// 代理目标可被环境变量覆盖(e2e 起独立端口的服务端时使用)。
const apiProxyTarget = process.env.API_PROXY_TARGET ?? "http://localhost:8080";

const githubPagesBasePath = normalizeGitHubPagesBasePath(
  process.env.GITHUB_PAGES_BASE_PATH ?? inferGitHubPagesBasePath()
);

function inferGitHubPagesBasePath() {
  if (process.env.GITHUB_ACTIONS !== "true" || !process.env.GITHUB_REPOSITORY) {
    return undefined;
  }

  const repositoryName = process.env.GITHUB_REPOSITORY.split("/").pop();
  return repositoryName ? `/${repositoryName}/` : undefined;
}

function normalizeGitHubPagesBasePath(basePath?: string) {
  const trimmedBasePath = basePath?.trim();
  if (!trimmedBasePath || trimmedBasePath === "/") {
    return undefined;
  }

  return `/${trimmedBasePath.replace(/^\/+|\/+$/g, "")}/`;
}

export default defineConfig({
  html: {
    outputStructure: "flat",
    title: "Monorepo Template admin"
  },
  output: {
    distPath: {
      html: ""
    },
    ...(githubPagesBasePath ? { assetPrefix: githubPagesBasePath } : {})
  },
  ...(devServerPort ? { server: { port: devServerPort } } : {}),
  dev: {
    server: {
      proxy: {
        // 开发态把 /api 转发到 Go server 并去掉前缀(端口约定见 docs/mvp-plan.md)。
        "/api": {
          target: apiProxyTarget,
          changeOrigin: true,
          pathRewrite: { "^/api": "" }
        }
      }
    }
  },
  plugins: [appTools()]
});
