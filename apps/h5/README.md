# apps/h5 — CMS 活动 H5(Modern.js SSR 占位工程)

CMS 的活动 H5 端(`@monorepo-template/h5`,hello-world 阶段),Modern.js appTools + SSR(`server.ssr: true`),消费公开契约 [`openapi/h5/openapi.yaml`](../../openapi/h5/openapi.yaml) 的 `GET /api/h5/ping`:首页 loader 在服务端请求该端点,把 `data.message`(`pong from h5 api`)渲染到页面;请求失败自捕获降级为 null,页面展示降级文案。数据流范式与 `apps/site` 一致(`src/routes/page.data.ts` 具名导出 loader,组件用 `useLoaderData` 读取)。

占坑期端点匿名只读;契约预留 `bearerAuth`,C 端用户体系落地前无鉴权逻辑。

## 命令

```bash
pnpm --filter @monorepo-template/h5 dev         # Modern.js dev server(SSR 开启)
pnpm --filter @monorepo-template/h5 build       # 生产构建(modern build)
pnpm --filter @monorepo-template/h5 serve       # 本地起生产产物(modern serve)
pnpm --filter @monorepo-template/h5 test        # vitest 单测
pnpm --filter @monorepo-template/h5 typecheck   # tsc --noEmit
pnpm --filter @monorepo-template/h5 gen:api     # orval 生成 src/api/generated/ + controllers.gen.ts
```

- dev server 默认端口 **18082**(`PORT` 环境变量可覆盖);
- `gen:api` 由 [`openapi/h5/openapi.yaml`](../../openapi/h5/openapi.yaml) 生成请求函数与类型(orval 以 `externalRefs.allow: ["*"]` 直接解析多文件骨架),生成物禁止手改。

## API 接入与联调

- 请求统一经 `src/api/client.ts`(orval mutator):匿名受众无会话,只做 `{code, message, data}` 信封解包与错误提示,无 token 注入与 401 跳转逻辑;
- baseURL 双端规则(照抄 `apps/site`):SSR 服务端用绝对地址(env `H5_API_BASE`,默认 `http://127.0.0.1:18085`),浏览器端空串走同源相对路径,环境判断统一 `typeof window === "undefined"`;
- dev 代理:`modern.config.ts` 把 `/api` 代理到 `http://127.0.0.1:18085`(env `API_PROXY_TARGET` 可覆盖);
- Go server 监听端口由 `SERVER_PORT` 控制(默认 8080),联调时保持与代理目标 / `H5_API_BASE` 一致(如 `SERVER_PORT=18085` 启动后端)。

## 目录约定

与其他 JS 新端统一:`src/` 下 `api/`(orval 生成物 + `client.ts` mutator + `controllers.gen.ts`)、`component/`、`config/`、`consts/`、`hooks/`、`store/`(zustand)、`routes/`(页面与 loader)。
