# apps/desktop — CMS 桌面端(electron-vite 占位工程)

CMS 的 Electron 桌面端(`@monorepo-template/desktop`,hello-world 阶段),electron-vite + React(main / preload / renderer 三段式),消费 C 端公开契约 [`openapi/app/openapi.yaml`](../../openapi/app/openapi.yaml) 的 `GET /api/app/ping`:渲染层启动时请求该端点,把 `data.message`(`pong from app api`)渲染到窗口;失败时降级展示错误信息。与 `apps/miniapp`、`apps/mobile` 共享同一份 C 端契约。

占坑期端点匿名只读;契约预留 `bearerAuth`,C 端用户体系落地前无鉴权逻辑。

## 命令

```bash
pnpm --filter @monorepo-template/desktop dev         # electron-vite dev:渲染层 dev server + Electron 窗口
pnpm --filter @monorepo-template/desktop build       # electron-vite build,产出 out/{main,preload,renderer}
pnpm --filter @monorepo-template/desktop test        # vitest 单测
pnpm --filter @monorepo-template/desktop typecheck   # tsc --noEmit(tsconfig.node.json + tsconfig.web.json)
pnpm --filter @monorepo-template/desktop gen:api     # orval 生成 src/renderer/src/api/generated/ + controllers.gen.ts
```

- 渲染层 dev server 端口 **18083**;
- `gen:api` 由 [`openapi/app/openapi.yaml`](../../openapi/app/openapi.yaml) 生成请求函数与类型(orval 以 `externalRefs.allow: ["*"]` 直接解析多文件骨架),生成物禁止手改。

## API 接入与联调

- API 层在 `src/renderer/src/api/`(orval 生成物 + `client.ts` mutator + `controllers.gen.ts`):匿名受众无会话,只做 `{code, message, data}` 信封解包与错误提示,无 token 注入与 401 跳转逻辑;
- axios baseURL 为空串,走同源相对路径:dev 由渲染层 dev server 把 `/api` 代理到 `http://127.0.0.1:18085`(见 `electron.vite.config.ts`),生产由部署侧网关同域转发;
- Go server 监听端口由 `SERVER_PORT` 控制(默认 8080),联调时保持与代理目标一致。

## 占坑期边界

- 只跑 dev / build / test / typecheck,**不打安装包**:未接入 electron-builder 等打包与自动更新,发布流程列入后续阶段;
- 目录约定与其他 JS 新端统一:`src/renderer/src/` 下 `api/`、`component/`、`config/`、`consts/`、`hooks/`、`store/`(zustand);`src/main`、`src/preload` 为 Electron 主进程与预加载脚本。
