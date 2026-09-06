# AGENTS.md

本文件面向 AI 编码助手。人读的完整规范见 [docs/development.md](docs/development.md)。

## 项目是什么

pnpm + Turborepo monorepo,两个应用:

- `apps/admin` — Modern.js + React 19 + Arco Design 管理后台
- `apps/server` — Go API 服务

`openapi/` 目录是前后端唯一接口契约,按受众分文件:当前为 `admin.yaml`,两侧代码均由它生成;对外网站立项后新增 `site.yaml`(多受众方案见 [docs/multi-audience-contracts.md](docs/multi-audience-contracts.md))。
当前按 [docs/mvp-plan.md](docs/mvp-plan.md) 分阶段交付管理后台 MVP;新增功能先改 `openapi/` 下对应受众契约落契约,再写实现。

## 常用命令(仓库根执行)

- `pnpm dev` — 一条命令并行启动 admin + server
- `pnpm gen:api` — 从 openapi/ 契约生成 admin 类型与 server 接口代码
- `pnpm lint` / `pnpm typecheck` / `pnpm test`
- `pnpm verify` — 提交前完整校验,改动后必须通过

## 硬性规则

### 接口契约

1. 接口改动先改 `openapi/` 下对应受众契约(admin 改 `admin.yaml`),再 `pnpm gen:api`,然后补实现;
2. 生成物(`apps/admin/src/api/generated/`、`apps/admin/src/api/controllers.gen.ts`、`apps/server/gen/`)禁止手改;前端接口函数一律调用 orval 生成物,Controller 绑定层由 gen:api 从契约 tags 自动生成,不手写请求函数;横切逻辑(token/401/错误提示)只写在 `src/api/client.ts`(mutator 入口);
3. 两侧不允许手写与契约重复的接口类型。

### admin(详见 [docs/admin.md](docs/admin.md))

4. UI 优先用 `@arco-design/web-react` 基础组件,不满足才自定义;
5. 页面照抄 arco-design-pro 范式:列表页 = `Card` + 查询 `Form` + `Table` + `Pagination`,新建编辑用 `Modal` + `Form`;
6. 目录分区:`src/api`(client.ts / controllers.ts / queryKeys.ts / generated)/ `components` / `hooks` / `routes`(页面)/ `store`(全局状态)/ `utils` / `constants` / `config`;
7. 复用规则:2 个及以上页面用 → 提到 `src/components`、`src/hooks`;单页面用 → 留在页面目录内;客户端全局状态 → zustand(`src/store/`,每个领域一个 `useXxxStore`),不与 Modern.js model 等其他方案混用;
8. 服务端状态一律 TanStack Query(`useQuery`/`useMutation` + `SystemController.xxx()` 直调,queryKey 集中在 `src/api/queryKeys.ts`),禁止 useEffect 手动拉接口、禁止 ahooks 的 useRequest;操作按钮用 `<AuthGate permission="...">` 包裹(无权限置灰 + Tooltip),菜单可见性按最小颗粒度判定(模块下任一 api 权限码即可);
9. 工具函数:通用 React 逻辑优先 ahooks,纯数据操作优先 lodash(按方法引入 `lodash/xxx`),两者覆盖不了才自写;
10. 单文件超约 300 行必须拆分,页面主入口只做数据编排。

### server(详见 [docs/server.md](docs/server.md))

11. 分层单向依赖:`handler → service → repo`;handler 薄、service 厚、repo 只管存取;
    11a. **日志双轨**:HTTP 访问日志只写 slog + 按天滚动文件(`logs/`,按 `ACCESS_LOG_RETAIN_DAYS` 清理),不入库、不查询;业务操作日志由 service 层在增删改与登录处显式埋点(`oplog.Record`,action 形如 `user.delete`,description 写人话,失败也记),查询接口只暴露业务日志;
12. `main.go` 只做装配;单文件超约 400 行按资源拆分;
13. handler 实现 oapi-codegen 生成的 `ServerInterface`,一个资源一个文件;
14. server 通过自身 `package.json` 的 `dev`/`gen:api` 脚本接入 turbo,保证根命令可用。

### 通用

15. 提交信息遵循 Conventional Commits;代码风格交给仓库 prettier/eslint/gofmt 配置,不自创风格;文件与符号命名必须语义化(按资源/领域),禁止 stage/temp/new/copy 等过程性命名;
16. 改代码前先查 `src/components`、`src/hooks`、`internal/` 是否已有可复用实现,先复用再新建。
