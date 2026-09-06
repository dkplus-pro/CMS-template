# 开发规范总览

本仓库是一个 pnpm + Turborepo monorepo,包含两个应用:

- `apps/admin` — Modern.js + React 19 + Arco Design 管理后台
- `apps/server` — Go 编写的 API 服务

详细规范按方向拆分:[admin 开发规范](./admin.md) · [server 开发规范](./server.md)。
MVP 版本的功能范围与分阶段交付计划见 [MVP 交付计划](./mvp-plan.md)。
数据库表结构与 SQLite → MySQL 迁移方案见 [数据库设计](./database.md)。
接口与页面的全量核对清单见 [接口与页面清单](./api-pages.md)。

## 目录结构

```text
apps/
  admin/               管理后台(Modern.js)
  server/              API 服务(Go)
packages/              共享配置(tsconfig / eslint / prettier / commitlint)
docs/                  开发文档
openapi.yaml           前后端唯一接口契约(单一事实源)
scripts/               CI / 部署脚本
tests/                 仓库级测试(jest / playwright)
```

## 常用命令

所有命令都在仓库根执行:

| 命令                           | 作用                                                                              |
| ------------------------------ | --------------------------------------------------------------------------------- |
| `pnpm install`                 | 安装依赖                                                                          |
| `pnpm dev`                     | 一条命令并行启动全部应用(admin + server)                                          |
| `pnpm gen:api`                 | 由 `openapi.yaml` 生成 admin 类型与接口函数(orval)、server 接口骨架(oapi-codegen) |
| `pnpm lint` / `pnpm typecheck` | 静态检查                                                                          |
| `pnpm test`                    | 单测 + e2e                                                                        |
| `pnpm verify`                  | 本地提交前完整校验                                                                |

**约定**:每个应用(包括 Go 的 server)都在自己的 `package.json` 里暴露统一的 `dev` / `build` / `gen:api` 脚本,由 turbo 编排。Go 侧通过 npm-script 包装 `go run` 等命令,保证根目录 `pnpm dev` 一条命令即可跑起整个项目。

## OpenAPI 契约工作流

`openapi.yaml` 是前后端唯一接口契约,**双方代码都由它生成**:

1. 修改接口时,先改 `openapi.yaml`,再执行 `pnpm gen:api`;
2. 生成物位于 `apps/admin/src/api/generated/`(orval:类型 + 接口函数)与 `apps/server/gen/`(oapi-codegen),**禁止手改**;
3. admin 直接调用 orval 生成的接口函数(统一走 `src/api/client.ts` mutator),server 实现 oapi-codegen 生成的 `ServerInterface`,两侧不允许出现与契约不一致的手写类型。

## 通用规范

- 代码风格交给仓库统一配置(prettier / eslint / gofmt),不做口头约定;
- **命名语义化**:文件与符号名必须表达其职责(按资源或领域,如 `users.go`、`auth.ts`、`use-file-url.ts`),**禁止 `stage4`、`temp`、`new`、`copy`、`utils2` 这类过程性/序号命名**;新增功能放在既有资源文件中,文件过大时按资源拆分而不是按开发阶段拆分;
- 提交信息遵循 Conventional Commits(commitlint 已配置);
- 单文件不宜过长:admin 侧约 300 行、server 侧约 400 行触顶即拆分,主入口文件永远保持"只做装配"的简单形态;
- 优先复用再新建:改代码前先看 `src/components`、`src/hooks`、`internal/` 里是否已有可复用的实现。
