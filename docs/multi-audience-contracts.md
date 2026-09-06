# 多受众契约方案(admin / site 拆分)

本文是"一个 Go 服务、多份契约、每个 app 各取所需"的**执行手册**。背景:当前根 `openapi.yaml` 只服务 admin 后台;未来会新增对外网站 app,它消费 admin 配置的内容,Go 服务要同时给对外网站提供公开 API。决策(已与维护者确认):按**受众**拆分契约文件,不拆 Go 服务。

## 决策与边界

- **admin API** 与 **site API** 是两个受众:认证不同(JWT+RBAC vs 匿名公开)、迭代速度不同(快 vs 稳定版本化)、缓存策略不同(无缓存 vs CDN 友好)、DTO 详略不同(全字段 vs 裁剪)。受众不同 = 契约文件不同;
- 两受众读同一份数据、同一个 repo 层,**一个 Go 二进制**同时挂载两套路由,各自挂各自的中间件链;
- **不拆服务**:独立扩容/团队分拆等信号出现前,拆服务只增加运维成本。契约先分开,未来真拆服务时是纯搬运(见文末"何时升级为多服务");
- admin 契约路径维持无前缀(admin 客户端自带 `/api` baseURL,dev 代理 rewrite);**site 契约路径字面带 `/site/v1` 前缀**(公开 API 自描述、版本化,公网网关按此前缀放行)。

## 执行总览

| 步骤 | 内容                                                             | 时机           | 行为变化       |
| ---- | ---------------------------------------------------------------- | -------------- | -------------- |
| A    | 契约搬家:`openapi.yaml` → `openapi/admin.yaml`,全链路引用更新    | 可立即执行     | **零**(纯重构) |
| B    | 新增 `openapi/site.yaml`、gen/site、公开路由链、apps/site 脚手架 | 对外网站立项时 | 新增公开端点   |

每步独立验收、独立提交。**不要在做步骤 A 时顺手做 B**。

---

## 步骤 A:契约搬家(纯重构)

### A1 移动契约文件

```bash
mkdir -p openapi && git mv openapi.yaml openapi/admin.yaml
```

### A2 server 生成配置改名并指向新路径

`git mv apps/server/oapi.cfg.yaml apps/server/oapi.admin.cfg.yaml`,内容改为(注释与 package 同步):

```yaml
# oapi-codegen 配置(admin 契约):生成物(gen/admin/)禁止手改,改接口请编辑 openapi/admin.yaml 后重新执行 pnpm gen:api
package: admin
output: gen/admin/gen.go
generate:
  models: true
  std-http-server: true
```

### A3 server gen:api 脚本

`apps/server/package.json` 的 `scripts.gen:api` 改为:

```json
"gen:api": "go tool oapi-codegen -config oapi.admin.cfg.yaml ../../openapi/admin.yaml"
```

### A4 重新生成 server 代码

```bash
rm -rf apps/server/gen
pnpm gen:api
```

产物为 `apps/server/gen/admin/gen.go`,包名 `admin`,导入路径 `github.com/cms-template/server/gen/admin`。

### A5 更新 Go 侧 import(**保留别名 gen,handler 内类型引用零改动**)

以下文件的 `gen "github.com/cms-template/server/gen"` 统一改为 `gen "github.com/cms-template/server/gen/admin"`:

```bash
grep -rln '"github.com/cms-template/server/gen"' apps/server --include="*.go"
# 预期命中:cmd/server/main.go、internal/handler/*.go(全部)
```

逐个文件只改 import 路径一行,**不改别名、不改任何 `gen.Xxx` 引用**。完成后:

```bash
cd apps/server && gofmt -w ./cmd ./internal && go build ./... && go vet ./...
```

### A6 swagger 配置与托管

1. `apps/server/internal/config/config.go`:`SWAGGER_SPEC_PATH` 默认值 `"../../openapi.yaml"` → `"../../openapi/admin.yaml"`,注释同步;
2. `apps/server/internal/httpapi/swagger.go`:
   - spec 端点路径 `/swagger/openapi.yaml` → `/swagger/admin.yaml`(switch case 一处);
   - `swaggerIndexHTML` 常量里 `url: "./openapi.yaml"` → `url: "./admin.yaml"`;
   - 函数注释与日志字段同步。

### A7 admin 生成配置

`apps/admin/orval.config.ts`:`input: "../../openapi.yaml"` → `input: "../../openapi/admin.yaml"`,首行注释里"由根 openapi.yaml 生成"改为"由 openapi/admin.yaml 生成"。`apps/admin/scripts/generate-controllers.mjs` **不需要改**(它从 orval 生成目录推导,不读契约)。

### A8 文档引用更新

执行 `grep -rn "openapi.yaml" README.md AGENTS.md docs/ --include="*.md"`,逐处把"根 `openapi.yaml` 是前后端唯一接口契约"类表述改为:

> `openapi/` 目录是前后端唯一接口契约,按受众分文件:当前为 `admin.yaml`;对外网站立项后新增 `site.yaml`(方案见 [multi-audience-contracts.md](docs/multi-audience-contracts.md))。

其中 AGENTS.md 硬性规则第 1、2 条的 `openapi.yaml`、`apps/server/gen/` 字样同步替换;`apps/server/internal/handler/handler.go`、`apps/server/internal/httpapi/respond.go` 等代码注释里的契约路径一并修正(`grep -rn "openapi.yaml" apps/server --include="*.go"`)。

### A9 步骤 A 验收(DoD)

- [ ] `git grep -n "openapi.yaml"` 仅剩历史叙述性文字,无配置/代码引用旧路径;
- [ ] `pnpm gen:api` 双端产物正常生成(gen/admin/、src/api/generated/);
- [ ] `cd apps/server && go build ./... && go test ./...` 通过;
- [ ] `pnpm verify` 全绿(含 e2e——行为零变化,用例不应需要任何修改);
- [ ] `/swagger` 页面正常展示 admin 契约;
- [ ] 提交信息:`refactor: move openapi.yaml to openapi/admin.yaml for multi-audience contracts`。

---

## 步骤 B:site 契约与公开链路(立项时执行)

### B1 新增对外契约 `openapi/site.yaml`

骨架如下(首个端点即真实需求:对外网站读取站点配置;后续端点按同一约定累加):

```yaml
openapi: 3.0.3
info:
  title: CMS Site API
  version: 0.1.0
  description: |
    对外站点公开 API(只读、无鉴权)。路径一律带 /site/v1 前缀,公网网关按此放行。
    响应与 admin 同约定:{code, message, data};错误用 HTTP 状态码 + message。
    约定:只提供 GET;DTO 按对外需要裁剪(不原样暴露 admin 模型);媒体字段直接给 CDN 直链。
tags:
  - name: site
paths:
  /site/v1/site-info:
    get:
      operationId: getSiteInfo
      summary: 站点公开信息(站名、Logo 等,来自 admin 系统配置)
      tags: [site]
      responses:
        "200":
          description: 站点公开信息
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/SiteInfoResponse"
components:
  schemas:
    SiteInfo:
      type: object
      required: [siteName, logoUrl]
      properties:
        siteName:
          type: string
        logoUrl:
          type: string
          description: Logo 图片地址(CDN 直链或空串)
    SiteInfoResponse:
      type: object
      required: [code, message, data]
      properties:
        code: { type: integer }
        message: { type: string }
        data:
          $ref: "#/components/schemas/SiteInfo"
```

**site 契约维护规则**(后续每个端点都遵守):只写 GET;路径带 `/site/v1` 前缀;不声明 `securitySchemes`(公开);DTO 独立命名(`Site` 前缀),即使与 admin 模型相似也不复用引用——对外字段裁剪是刻意的;媒体 URL 直接用 `files.url` 的 CDN 直链,**不暴露** `/files/{id}/content`(那是 admin 登录态端点)。

### B2 server 生成配置与脚本

1. 新增 `apps/server/oapi.site.cfg.yaml`:

   ```yaml
   # oapi-codegen 配置(site 契约):生成物(gen/site/)禁止手改,改接口请编辑 openapi/site.yaml 后重新执行 pnpm gen:api
   package: site
   output: gen/site/gen.go
   generate:
     models: true
     std-http-server: true
   ```

2. `apps/server/package.json` 的 `gen:api` 改为:

   ```json
   "gen:api": "go tool oapi-codegen -config oapi.admin.cfg.yaml ../../openapi/admin.yaml && go tool oapi-codegen -config oapi.site.cfg.yaml ../../openapi/site.yaml"
   ```

### B3 site handler(独立子包,不撑大 admin Handler)

新建 `apps/server/internal/handler/site/` 子包:`site.go` 定义 `SiteHandler`(持有 logger 与所需的 service,如 configsService),`site_info.go` 实现 `GET /site/v1/site-info`(读 system 配置组,组装 `sitegen.SiteInfo`,写 `Cache-Control: public, max-age=60`)。

**约定**:site 路由**禁止**加入 `internal/httpapi/permission.go` 的 RoutePermissions(公开接口没有权限码);site handler 只调 service 的**查询**方法;返回 DTO 用 `sitegen` 类型,不复用 admin 的 gen 类型。

### B4 main.go 双链路挂载(关键步骤,照此改)

现状:root mux 同时挂 swagger 与 admin 路由,外层套一条含 JWT/权限的中间件链。改为**两个子 mux、两条链**:

```go
adminMux := http.NewServeMux()
gen.HandlerFromMux(handler.New(/* 不变 */), adminMux) // gen 仍指向 gen/admin,见步骤 A5

siteMux := http.NewServeMux()
sitegen.HandlerFromMux(sitehandler.New(logger, configsService), siteMux)

mux := http.NewServeMux()
httpapi.RegisterSwagger(mux, logger, cfg.Swagger)
// 公开链:/site/v1/*,无 JWT、无权限校验(后续可加限流中间件)
mux.Handle("/site/v1/", httpapi.Chain(siteMux,
    httpapi.ClientIP(),
    httpapi.Logging(logger),
    httpapi.Recover(logger),
))
// 管理链:其余全部,维持现有 JWT + 权限中间件
mux.Handle("/", httpapi.Chain(adminMux,
    httpapi.ClientIP(),
    httpapi.Logging(logger),
    httpapi.JWTAuth(logger, cfg.JWT.Secret, jwtSkip),
    httpapi.PermissionCheck(loadPermissionCodes, logger),
    httpapi.Recover(logger),
))

srv := &http.Server{Addr: cfg.HTTP.Addr, Handler: mux, ReadHeaderTimeout: 5 * time.Second}
```

要点与防呆:

- 导入:`sitegen "github.com/cms-template/server/gen/site"`、`sitehandler "github.com/cms-template/server/internal/handler/site"`;
- Go 1.22 mux 规则:`/site/v1/`(子树)比 `/` 更具体,自动分流,**注册顺序无关**;swagger 注册在 root mux 上且路径更具体,不受 `/` 链影响(不进 JWT 链,与现状一致);
- **不要**用"JWTSkipPaths 加 /site 前缀"的替代方案(两条链各自独立才是本方案的核心,避免 admin 中间件知道 site 的存在);
- `jwtSkip`、`loadPermissionCodes` 等现有变量原位保留。

### B5 swagger 双契约展示

1. `internal/config`:新增 `SiteSpecPath`,env `SWAGGER_SITE_SPEC_PATH`,默认 `../../openapi/site.yaml`;
2. `swagger.go` 改造:admin spec 读取失败仍 panic(现状);site spec **读不到只记 warn 跳过**(允许契约先上、文件后补);spec 端点改为 `/swagger/admin.yaml` 与 `/swagger/site.yaml`(site 仅在加载成功时挂载);首页 HTML 改为多契约下拉:

   ```js
   window.ui = SwaggerUIBundle({
     urls: [
       { name: "admin", url: "./admin.yaml" },
       // site 加载成功时才注入这一行:
       { name: "site", url: "./site.yaml" }
     ],
     dom_id: "#swagger-ui",
     persistAuthorization: true
   });
   ```

   实现:HTML 常量里留 `__SPEC_URLS__` 占位,`RegisterSwagger` 按加载结果 `strings.Replace` 注入。

### B6 apps/site 脚手架(对外网站 app)

- 新建 `apps/site`(技术栈届时另定,契约消费方式与 admin 相同):复制 `apps/admin/orval.config.ts`,`input` 改为 `../../openapi/site.yaml`,输出目录独立;复制 `scripts/generate-controllers.mjs`(其从生成目录推导,天然复用);
- `client.ts` 从 admin 复制后**删掉** token 注入与 401 跳登录(公开站无会话),保留 envelope 解包与错误提示;
- dev 代理照 admin 模式:site app 代理 `/site` → server 8080;生产由网关同域转发,**跨域 CORS 中间件默认不加**,确需跨域再单独评审;
- e2e 如需覆盖 site,在 `playwright.config.ts` 增加第三个 webServer(参照现有两条)。

### B7 部署与安全

- 公网网关/nginx **只放行 `/site/v1/*`**;admin 路径(其余全部)仅内网或 VPN 可达——单服务拿到接近双服务的安全边界;
- site GET 端点统一带 `Cache-Control: public, max-age=60`(写在 handler;端点变多后再抽中间件);
- 限流、WAF 交给网关层,不在本服务内实现(后续需要再议)。

### B8 步骤 B 验收(DoD)

- [ ] `pnpm gen:api` 生成 gen/site 与 apps/site 的 orval 产物;
- [ ] 无 token `curl /site/v1/site-info` 返回 200 且含 Cache-Control;无 token `curl /users` 仍 401(admin 链路回归);
- [ ] `/swagger` 下拉可切换 admin / site 两份契约;
- [ ] api-pages.md 新增"site 对外接口"章节并登记端点;
- [ ] `pnpm verify` 全绿;提交信息:`feat: site api contract and public route chain (stage 7)`。

---

## 维护规则(执行后长期生效)

1. 新端点先问受众:进 `admin.yaml` 还是 `site.yaml`;**同一操作禁止在两份契约重复定义**(对外需要的 admin 能力,按对外 DTO 在 site.yaml 重新声明,不互相 $ref);
2. 权限码只属于 admin 契约与 RoutePermissions;site 无权限概念,公开边界靠"只读 + 网关放行前缀";
3. site 契约变更视同对外承诺:只加不删,破坏性变更升 `/site/v2`;
4. `docs/api-pages.md` 按受众分章节维护;`AGENTS.md` 契约工作流条目指向本文。

## 何时升级为多服务(方案 C)

出现任一信号再拆:`/site/v1` 流量需要独立扩容;admin 需整体物理隔离(网关路径拦截不满足);团队分拆各自交付。届时把 `gen/site`、`internal/handler/site` 及其依赖的 service/repo 抽成新二进制即可——契约早已分开,拆分是纯搬运,这就是本方案保留的廉价期权。
