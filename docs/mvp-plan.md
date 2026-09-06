# 管理后台 MVP 分阶段交付计划

本计划回答"做什么、按什么顺序";"怎么写代码"遵循 [development.md](./development.md)、[admin.md](./admin.md)、[server.md](./server.md)。接口与页面的全量核对清单见 [api-pages.md](./api-pages.md),本文各阶段表格仅作范围摘要。

## 目标与边界

MVP 目标:交付一个可登录、按角色控权、可管理用户/角色/菜单、可查操作日志、可改系统配置的管理后台;全程 OpenAPI 契约驱动(Go 服务端 + `pnpm gen:api` 生成前端 API/Types + Swagger UI 展示)。

明确不做(非目标):数据权限、SSO/OAuth/多因素登录、多租户、审批流、消息通知、审计报表、国际化。

## 总体技术决策

| 项         | 决策                                              | 说明                                                                                                                                                |
| ---------- | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| 接口契约   | 根 `openapi.yaml` 单一事实源                      | tags 按模块划分(auth/users/roles/permissions/menus/logs/configs/dicts/files);server 用 oapi-codegen,admin 用 orval 生成类型 + 接口函数(见 admin.md) |
| Swagger UI | server 暴露 `GET /swagger`                        | 直接托管根 `openapi.yaml`;dev 必开,生产由配置开关                                                                                                   |
| 存储       | GORM:dev SQLite / prod MySQL                      | 双端同一套模型建表;表结构与迁移方案见 [database.md](./database.md)                                                                                  |
| 认证       | JWT(HS256,Bearer)                                 | 有效期 2h,MVP 不做 refresh token 与服务端登出失效;密码 bcrypt                                                                                       |
| 权限模型   | RBAC:user → role → permission                     | permission 分 `menu`(菜单/页面/按钮可见)与 `api`(接口/操作)两类,统一存一张表;数据权限不做                                                           |
| 前端权限   | 登录后拉取权限码 + 可见菜单                       | 动态生成路由与侧边栏;按钮级用权限码控制显隐;**服务端中间件独立校验,前端显隐只是体验,不是安全边界**                                                  |
| 响应约定   | `{code, message, data}`                           | 分页入参 `page`/`pageSize`,返回 `{list, total}`;错误用 HTTP 状态码 + message                                                                        |
| 联调       | admin 开发态代理 `/api` → `http://localhost:8080` | 免 CORS;端口约定 server=8080、admin=8081                                                                                                            |
| 前端数据层 | TanStack Query + orval axios 直调                 | 服务端状态用 `useQuery`/`useMutation` + `XxxController.xxx()`(见 admin.md);客户端全局状态用 Modern.js model                                         |
| 工具库     | lodash + ahooks                                   | 通用 React 逻辑优先 ahooks,纯数据操作优先 lodash;请求不用 ahooks useRequest                                                                         |
| 文件存储   | storage 接口 + local 实现                         | 预留 S3 实现,不阻塞 MVP                                                                                                                             |

## 数据模型(一览)

完整字段、索引与类型约定见 [database.md](./database.md)。

| 表                 | 关键字段                                                                                 | 说明                                     |
| ------------------ | ---------------------------------------------------------------------------------------- | ---------------------------------------- |
| users              | id, username, password_hash, nickname, email, status                                     | status: 1 启用 / 0 禁用                  |
| roles              | id, code, name, remark, status                                                           | 内置超级管理员角色不可删                 |
| user_roles         | user_id, role_id                                                                         | 用户 ↔ 角色                              |
| permissions        | id, code, type(menu/api), name, parent_id                                                | 统一权限点;code 见命名规范               |
| role_permissions   | role_id, permission_id                                                                   | 角色 ↔ 权限,唯一关联表                   |
| menus              | id, parent_id, name, path, component_key, sort, visible, permission_id                   | 菜单树;删除时联动处理权限点              |
| operation_logs     | id, user_id, username, method, path, action, ok, status_code, ip, latency_ms, created_at | 只增不改                                 |
| files              | id, name, orig_name, mime, size, storage, path, uploader_id                              | storage: local                           |
| sys_configs        | group, key, value                                                                        | KV,value 存 JSON;group: system / storage |
| dicts / dict_items | code / dict_id, label, value, sort, status                                               | 字典与字典项                             |

## 阶段总览

| 阶段 | 主题                                         | 规模 | 前置 | 可并行            |
| ---- | -------------------------------------------- | ---- | ---- | ----------------- |
| 0    | 工程基座(契约流水线 + Swagger UI + 双端骨架) | S    | —    | —                 |
| 1    | 登录与账号                                   | S    | 0    | —                 |
| 2    | 用户 · 角色 · 权限(RBAC 核心,API 权限生效)   | L    | 1    | —                 |
| 3    | 菜单管理与动态路由                           | M    | 2    | 与阶段 4 前半并行 |
| 4    | 操作日志 · 系统基础配置                      | M    | 2    | 与阶段 3 并行     |
| 5    | 文件管理(整体可后置)                         | M    | 4    | 独立              |

规模:S ≈ 1-2 天,M ≈ 3-4 天,L ≈ 5-7 天(单人有效开发时间,仅用于排期参考)。

## 阶段 0:工程基座

目标:打通"改契约 → 双端生成 → 联调可见"的流水线,双端跑起空壳。

契约:仅 `GET /healthz` + 公共 schemas(Error、分页入参/出参、 bearerAuth 安全定义)。

server:

- 初始化目录(cmd/internal/gen),实现 `ServerInterface` 空壳 + healthz;
- oapi-codegen 配置与 `gen:api` 脚本接入 turbo;
- 中间件骨架:日志、Recover、统一错误响应;`/swagger` 托管 Swagger UI;
- SQLite + GORM 接入;建表用 GORM AutoMigrate,表结构与 MySQL 迁移方案见 [database.md](./database.md)。

admin:

- Modern.js 接入 Arco Design,全局布局壳(侧边栏 + 顶栏 + 面包屑)与欢迎页;
- `src/api` 生成流水线跑通;请求客户端封装(token 注入、401 跳登录、统一 Message);
- dev 代理 `/api` → 8080。

验收:`pnpm dev` 一键起双端;`/swagger` 可浏览契约;`pnpm gen:api` 双端生成物更新;`pnpm verify` 通过。

## 阶段 1:登录与账号

| 方法 | 路径           | 说明                                     |
| ---- | -------------- | ---------------------------------------- |
| POST | /auth/login    | 登录,返回 token、有效期、用户信息        |
| POST | /auth/logout   | 退出(MVP 前端清 token)                   |
| GET  | /auth/me       | 当前用户 + 角色 + 权限码(为动态菜单预留) |
| PUT  | /auth/password | 校验旧密码后修改                         |

server:users 表与种子管理员(文档注明初始口令,建议首次登录即改);JWT 签发/校验中间件(除 /auth/login、/healthz、/swagger 外全量拦截);**操作日志中间件在本阶段埋点**(只记录不查询)。

admin:先切换 orval 接口生成(替换 openapi-typescript 手写薄函数模式,规范见 [admin.md](./admin.md));登录页;token 与当前用户进全局 model;路由守卫(未登录跳登录);顶栏用户下拉(修改密码弹窗、退出)。

验收:登录后进入壳;错误口令/禁用账号被拒;token 过期后任意请求跳登录;改密后旧 token 场景按新口令可登录。

## 阶段 2:用户 · 角色 · 权限(RBAC 核心)

| 方法               | 路径                    | 说明                                   |
| ------------------ | ----------------------- | -------------------------------------- |
| GET / POST         | /users                  | 列表(分页 + keyword/status 筛选)/ 新建 |
| GET / PUT / DELETE | /users/{id}             | 详情(含角色)/ 编辑 / 删除              |
| PATCH              | /users/{id}/status      | 启用 / 禁用(不可操作自己)              |
| PUT                | /users/{id}/roles       | 分配角色                               |
| GET / POST         | /roles                  | 角色列表 / 新建                        |
| GET / PUT / DELETE | /roles/{id}             | 角色 CRUD                              |
| PUT                | /roles/{id}/permissions | 角色分配权限(权限点 ID 全量覆盖)       |
| GET                | /permissions            | 全量权限点树(menu + api)               |

server:

- 权限相关五张表落地;**API 权限点以 server 路由注册表为源**,启动时 upsert 进 permissions(type=api);菜单权限点先由种子数据灌入(阶段 3 改为界面维护);
- API 鉴权中间件:按"方法 + 路径 → 权限码"注册表校验,未命中权限码的接口仅要求登录;
- 防呆:不可删除/禁用自己与内置管理员;删除角色前校验仍有绑定则拒绝。

admin:用户列表页(搜索表格范式)+ 新建/编辑弹窗 + 状态 Switch + 分配角色弹窗(多选);角色列表页 + 权限分配弹窗(Tree 勾选,菜单权限与 API 权限分组展示)。

验收:无权限账号调用对应 API 返回 403;管理员可完成用户/角色/授权全流程;`/auth/me` 返回的权限码随授权变化。

## 阶段 3:菜单管理与动态路由

| 方法                | 路径                | 说明                               |
| ------------------- | ------------------- | ---------------------------------- |
| GET                 | /menus              | 全量菜单树(管理端)                 |
| POST / PUT / DELETE | /menus, /menus/{id} | 菜单 CRUD(sort、visible、权限绑定) |
| GET                 | /auth/menus         | 当前用户可见菜单树                 |

server:menus 表;`/auth/menus` 按 user → roles → permissions 过滤;菜单增删改时联动维护其 menu 权限点。

admin:

- 菜单管理页:TreeTable 增删改、排序、显示/隐藏 Switch、权限码绑定;
- 登录后按 `/auth/menus` 动态生成侧边栏与路由;`component_key → lazy 组件`映射表放 `src/config`(白名单,禁止后端直接下发文件路径);
- 按钮级显隐封装权限组件/工具(`hasPermission(code)`)。

验收:调整角色权限后重新登录,菜单与按钮显隐随之变化;直接调用被限接口仍被服务端拒绝。

## 阶段 4:操作日志 · 系统基础配置(可与阶段 3 并行)

| 方法                      | 路径                                           | 说明                                                        |
| ------------------------- | ---------------------------------------------- | ----------------------------------------------------------- |
| GET                       | /operation-logs                                | 分页 + 用户/成功失败/时间范围筛选                           |
| GET / PUT                 | /configs/{group}                               | 读取/更新配置组(system: 站名、Logo URL;storage: 驱动与参数) |
| GET / POST / PUT / DELETE | /dicts、/dicts/{code}/items、/dicts/items/{id} | 字典与字典项 CRUD                                           |

server:日志查询补齐筛选;sys_configs、dicts/dict_items 表;配置变更写操作日志;存储配置 MVP 仅保存不生效(阶段 5 消费)。

admin:日志查询页(只读列表 + 详情抽屉);系统设置页(站点信息表单,Logo 先用 URL 输入);字典管理页(左字典列表、右字典项)。

验收:任意写操作可在日志页检索到操作人/时间/接口/结果;改站名后 admin 布局标题同步。

## 阶段 5:文件管理(整体可后置)

| 方法         | 路径                 | 说明                                |
| ------------ | -------------------- | ----------------------------------- |
| POST         | /files               | multipart 上传(大小/类型按配置限制) |
| GET          | /files               | 文件列表(分页)                      |
| GET / DELETE | /files/{id}          | 文件信息 / 删除                     |
| GET          | /files/{id}/download | 下载                                |

server:files 表;storage 接口 + local 实现(目录来自 storage 配置组);预留 S3 实现位。

admin:文件列表页(上传弹窗、图片预览、删除确认);系统设置页 Logo 升级为从文件库选择/直传。

验收:上传后可预览/下载/删除;超限类型与大小被拒并提示。

## 种子数据

超管账号与超级管理员角色(全权限);初始菜单树(系统管理:用户/角色/菜单/日志/配置);示例字典(如 status 通用状态);初始站点配置。

## 跨阶段约定

- **契约先行**:每个接口先落 `openapi.yaml` → `pnpm gen:api` → 再写实现;禁止跳过契约直接写 handler/前端类型;
- **权限码命名**:`模块:资源:动作`,如 `system:user:create`;菜单权限码同规范;
- **每阶段 DoD**:`pnpm verify` 全绿、Swagger UI 可演示当阶段接口、无手写重复类型、种子数据可重建;
- JWT 登出不失效是 MVP 取舍,需要立即失效时再加黑名单(后续迭代);
- 阶段 5 未启动前,涉及文件的场景(如 Logo)一律用 URL 字段过渡。
