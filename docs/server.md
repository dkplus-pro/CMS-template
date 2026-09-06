# Server 开发规范

技术栈:Go(标准库 `net/http` 即可,按需再引中间件库)。

## 目录结构

```text
apps/server/
  cmd/
    server/main.go       入口:只做"读配置 → 装配依赖 → 启动",不放业务
  internal/
    handler/             HTTP 层:实现 oapi-codegen 生成的 ServerInterface
    service/             业务逻辑层:核心规则都写在这里
    repo/                数据访问层:只管存取,不含业务判断
    config/              配置加载(env / 文件)
    types/               内部领域模型
  gen/                   oapi-codegen 生成物(勿手改)
  oapi.cfg.yaml          oapi-codegen 配置
  package.json           暴露 dev/build/gen:api 脚本,交给 turbo 编排
```

目录按层分区,禁止跨层乱引用:`handler → service → repo` 单向依赖,handler 不直接碰 repo,service 不感知 HTTP 细节。

数据库表结构、字段类型约定与 SQLite → MySQL 迁移方案见 [database.md](./database.md);repo 层通过 GORM 双驱动按配置切换。

## 文件存储(多厂商抽象)

文件介质统一经 `internal/storage.Storage` 接口存取,业务层(media 等)只面向接口,不感知厂商;方案全貌见 [mvp-plan.md](./mvp-plan.md) 阶段 6。

- **一个厂商一个文件**:`local.go`(本地目录)、`cos.go`(腾讯云 COS),后续 `tos.go`(火山引擎);各自封装 SDK 细节与配置读取,对象 key 规则统一为 uuid + 扩展名(+ 可选厂商前缀);
- **接口要点**:`Save` 流式写入返回 key 与字节数;`Open` 返回 `io.ReadCloser`(本地返回 `*os.File`,内容端点断言回 `io.ReadSeeker` 保留 Range);`URL(key)` 返回外网地址(CDN 直链,本地为空串);`Driver()` 返回驱动名写入 `files.storage`;`Delete` 幂等;
- **装配**:`main.go` 按 storage 配置组 `driver` 键 switch 构造实现,切换驱动 = 改配置 + 重启;配置键清单见 [database.md](./database.md) sys_configs 一节;
- **新增厂商**:实现接口 → seed 加 `{vendor}.*` 配置键 → main 装配分支 → `files.storage` 取值登记,业务代码零改动;
- **密钥纪律**:厂商密钥只进 storage 配置组(运维维护,admin 不展示),不写进代码与 CI;COS 链路冒烟用脚本手动执行。

## 接入 monorepo

Go 不归 pnpm 管,但为了根目录一条命令跑起整个项目,server 通过 `package.json` 暴露统一脚本:

```json
{
  "name": "@monorepo-template/server",
  "private": true,
  "scripts": {
    "dev": "go run ./cmd/server",
    "build": "go build -o bin/server ./cmd/server",
    "gen:api": "oapi-codegen -config oapi.cfg.yaml ../../openapi.yaml"
  }
}
```

这样根目录 `pnpm dev`(turbo `--parallel`)即可同时拉起 admin 与 server。

## OpenAPI 接口生成

- 契约唯一来源是仓库根的 `openapi.yaml`;
- `pnpm gen:api`(即 `oapi-codegen`)生成 `gen/` 下的 types、请求/响应骨架与 `ServerInterface`;
- handler 按接口拆文件实现 `ServerInterface`(一个资源一个文件,如 `handler/article.go`);
- 生成物不手改;契约变更流程:改 `openapi.yaml` → 重新生成 → 补 handler 实现。

## 分层与错误处理

- **handler 薄**:参数绑定、鉴权、调 service、按状态码写响应,不写业务规则;
- **service 厚**:业务规则、事务边界都在 service;入参出参用内部领域模型,不直接暴露生成物类型穿透各层;
- **repo 只管存取**:屏蔽具体存储(SQL / 内存),供 service 调用;
- 错误:包内定义哨兵错误(`errors.Is` / `errors.As`),跨层传递用 `fmt.Errorf("...: %w", err)`,在 handler 统一映射为 HTTP 状态码。

## 简洁性规则

- `main.go` 保持装配职责,超过约 **100 行**说明依赖组装该抽 `internal/config` 或 wire 函数了;
- 任何单文件超过约 **400 行**,按资源或职责拆分;
- 新增接口的固定动作:改 `openapi.yaml` → `gen:api` → 建 handler 文件 → 写 service 方法 →(需要时)扩 repo。
