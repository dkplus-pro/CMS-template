# 管理后台 MVP 分阶段交付计划

本计划回答"做什么、按什么顺序";"怎么写代码"遵循 [development.md](./development.md)、[admin.md](./admin.md)、[server.md](./server.md)。接口与页面的全量核对清单见 [api-pages.md](./api-pages.md),本文各阶段表格仅作范围摘要。

## 目标与边界

MVP 目标:交付一个可登录、按角色控权、可管理用户/角色/菜单、可查操作日志、可改系统配置的管理后台;全程 OpenAPI 契约驱动(Go 服务端 + `pnpm gen:api` 生成前端 API/Types + Swagger UI 展示)。

明确不做(非目标):数据权限、SSO/OAuth/多因素登录、多租户、审批流、消息通知、审计报表、国际化。

## 总体技术决策

| 项         | 决策                                              | 说明                                                                                                                                           |
| ---------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 接口契约   | 根 `openapi.yaml` 单一事实源                      | tags 按模块划分(auth/users/roles/permissions/logs/configs/dicts/files);server 用 oapi-codegen,admin 用 orval 生成类型 + 接口函数(见 admin.md)  |
| Swagger UI | server 暴露 `GET /swagger`                        | 直接托管根 `openapi.yaml`;dev 必开,生产由配置开关                                                                                              |
| 存储       | GORM:dev SQLite / prod MySQL                      | 双端同一套模型建表;表结构与迁移方案见 [database.md](./database.md)                                                                             |
| 认证       | JWT(HS256,Bearer)                                 | 有效期 2h,MVP 不做 refresh token 与服务端登出失效;密码 bcrypt                                                                                  |
| 权限模型   | RBAC:user → role → permission                     | permission 分 `menu`(菜单/页面/按钮可见)与 `api`(接口/操作)两类,统一存一张表;数据权限不做                                                      |
| 前端权限   | 静态菜单 + 权限码过滤(阶段 3 修订)                | 菜单与路由由前端代码静态声明(路径/组件/权限码),登录后按 `/auth/me` 下发的权限码过滤显隐;**服务端中间件独立校验,前端显隐只是体验,不是安全边界** |
| 响应约定   | `{code, message, data}`                           | 分页入参 `page`/`pageSize`,返回 `{list, total}`;错误用 HTTP 状态码 + message                                                                   |
| 联调       | admin 开发态代理 `/api` → `http://localhost:8080` | 免 CORS;端口约定 server=8080、admin=8081                                                                                                       |
| 前端数据层 | TanStack Query + orval axios 直调                 | 服务端状态用 `useQuery`/`useMutation` + `XxxController.xxx()`(见 admin.md);客户端全局状态用 zustand(`src/store/`)                              |
| 工具库     | lodash + ahooks                                   | 通用 React 逻辑优先 ahooks,纯数据操作优先 lodash;请求不用 ahooks useRequest                                                                    |
| 文件存储   | storage 接口 + local 实现                         | 预留 S3 实现,不阻塞 MVP                                                                                                                        |

## 数据模型(一览)

完整字段、索引与类型约定见 [database.md](./database.md)。

| 表                 | 关键字段                                                                                 | 说明                                     |
| ------------------ | ---------------------------------------------------------------------------------------- | ---------------------------------------- |
| users              | id, username, password_hash, nickname, email, status                                     | status: 1 启用 / 0 禁用                  |
| roles              | id, code, name, remark, status                                                           | 内置超级管理员角色不可删                 |
| user_roles         | user_id, role_id                                                                         | 用户 ↔ 角色                              |
| permissions        | id, code, type(menu/api), name, parent_id                                                | 统一权限点;code 见命名规范               |
| role_permissions   | role_id, permission_id                                                                   | 角色 ↔ 权限,唯一关联表                   |
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
| 3    | 权限驱动的菜单(静态菜单方案,修订)            | S    | 2    | 与阶段 4 前半并行 |
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

server:users 表与种子管理员(**初始账号 `admin` / `admin123`,首次登录后应在"修改密码"中更换**);JWT 签发/校验中间件(除 /auth/login、/healthz、/swagger 外全量拦截);**操作日志中间件在本阶段埋点**(只记录不查询)。种子逻辑在 `internal/repo/seed.go`,users 表为空时创建,可重复执行。

admin:orval 接口生成(见 [admin.md](./admin.md));登录页(`routes/login/`);token 与当前用户进 zustand(`store/auth.ts`);路由守卫(全局 layout 内,未登录跳登录);顶栏用户下拉(修改密码弹窗、退出)。

验收:登录后进入壳;错误口令/禁用账号被拒;token 过期后任意请求跳登录;改密后旧 token 场景按新口令可登录。**本阶段已交付并验收**(e2e 覆盖完整登录-登出流程)。

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

- 权限相关五张表落地;**API 权限点以 server 路由注册表为源**(`internal/httpapi/permission.go`),启动时 upsert 进 permissions(type=api);菜单权限点随注册表自动创建;种子含内置超级管理员角色 super_admin(全权限,启动时授予全量权限点并绑定初始管理员);
- API 鉴权中间件:按"方法 + 路径 → 权限码"注册表校验,未命中权限码的接口仅要求登录;
- 防呆:不可删除/禁用自己与内置管理员;删除角色前校验仍有绑定则拒绝。

admin:用户列表页(搜索表格范式)+ 新建/编辑弹窗 + 状态 Switch + 分配角色弹窗(多选);角色列表页 + 权限分配弹窗(Tree 勾选,菜单权限与 API 权限分组展示)。

验收:无权限账号调用对应 API 返回 403;管理员可完成用户/角色/授权全流程;`/auth/me` 返回的权限码随授权变化。**本阶段已交付并验收**(service 单测覆盖守卫与授权链路,e2e 覆盖用户创建流程)。

## 阶段 3:权限驱动的菜单(静态菜单方案,修订版)

> **方案修订说明**:本阶段曾按"菜单管理界面 + 服务端下发菜单树驱动动态路由"交付。实际使用方为非技术人员,让其在界面配置路由路径、组件 key、权限码不可接受且易错;且菜单结构变更本就伴随发版。修订为:**菜单与路由由前端代码静态声明,运行期只按权限码过滤显隐**。管理员只需要在角色管理里勾选权限(勾"用户管理"= 看得到用户菜单 + 能调相关接口),不再存在"菜单管理"这一概念。

### 新方案

- **菜单声明**:`apps/admin/src/config/menu.ts` 静态声明菜单树:路径、名称、图标、所需权限码、子菜单;权限码与服务端路由注册表(`internal/httpapi/permission.go` 的 Menu 字段)同名,由开发保证一致;
- **路由**:回到 Modern.js 约定式静态路由(页面在 `routes/` 下按目录组织),`$.tsx` 仅作 404 兜底;新增页面 = routes 页面 + menu.ts 一行声明 + 契约接口,**不存在运行时组件分发**;
- **侧边栏**:layout 按 `/auth/me` 下发的权限码过滤静态菜单声明——菜单绑定了权限码则要求命中,目录只要有任一可见子项即显示;面包屑取当前菜单名;
- **权限点**:服务端路由注册表继续在启动时创建 `menu:` 权限点(用于角色授权树分组),与 menus 表无关;
- **服务端**:不下发任何菜单数据;`/auth/me` 的 `permissions` 字段(已实现)即菜单显隐的全部依据。

### 接口变化

移除 5 个接口:`GET/POST /menus`、`GET/PUT/DELETE /menus/{id}`、`GET /auth/menus`;契约同步删除 MenuItem / MenuUpsertRequest / AuthMenuNode schemas 与 menus tag。`system:menu:*` 四个 api 权限点随注册表条目一并移除。

### 从旧方案回退(代码层)

阶段 3 已按旧方案交付,修订采用**原地修改而非整体回滚**(保留旧提交中的 permissions.Tree 指针挂载 bugfix 与 404 组件)。回退清单:

- server:删 `internal/{repo,service,handler}/menu*.go`、menus 表模型与 AutoMigrate 条目、SeedMenus、注册表 4 条 system:menu:× 路由;`/auth/me` 与权限中间件不动;
- admin:页面组件从 `src/pages/` 移回 `routes/`(users/roles);删 `config/component-registry.tsx`、`hooks/use-auth-menus.ts`、`pages/system/menus.tsx`;`$.tsx` 恢复为纯 404;layout 侧边栏改为"静态菜单 × 权限码过滤";
- 契约:删 menus 块后 `pnpm gen:api`,前端 `MenusController`、`getAuthMenus` 自动消失;
- 测试:e2e 去掉菜单管理页步骤,保留"调整角色权限 → 菜单显隐变化"断言。

验收:角色未授权某菜单权限码时侧边栏不显示该菜单、直访路由得到 404/403;授权后重新登录可见;直接调用被限接口仍被服务端 403。

## 阶段 4:操作日志 · 系统基础配置(可与阶段 3 并行)

> **操作日志方案修订**:已交付版本把 HTTP 访问日志(方法/路径/状态码/耗时)入库展示,那是给开发 debug 用的,对运营没有意义。本系统使用方是非技术运营人员,修订为**双轨日志**:
>
> - **HTTP 访问日志(开发用)**:不再入库,`slog` 结构化输出到 stdout + 按天滚动的日志文件(`logs/server-YYYY-MM-DD.log`),启动时清理超过保留天数(`ACCESS_LOG_RETAIN_DAYS`,默认 7 天)的旧文件;无查询接口,排查问题时看服务器文件。
> - **业务操作日志(运营用)**:记录"谁在什么时间对什么对象做了什么、结果如何",入库长期保留(审计数据,MVP 不清理),日志页只展示这一种。

### 业务操作日志(修订后)

记录载荷(一条 = 一次业务动作):

```json
{
  "user_id": 1,
  "username": "admin",
  "action": "user.delete",
  "resource": "user",
  "resource_id": "123",
  "description": "删除用户 张三(zhangsan)",
  "status": "success",
  "ip": "192.168.1.10",
  "created_at": "2026-09-06T12:30:00Z"
}
```

- **埋点方式:service 层显式记录**,不再用 HTTP 中间件自动抓——中间件只有请求信息,拿不到"张三"这类业务上下文,而 `description` 是给运营看的人话,必须写进业务代码;封装 `oplog.Record(ctx, db, Entry{...})` 供各 service 调用(操作人 ID/用户名/IP 从 context 的 claims 传递);
- **记录范围:增删改 + 登录,查询一律不记**。覆盖:登录(含失败)、修改密码、用户增删改/启停/分配角色、角色增删改/分配权限、配置组更新、字典与字典项增删改;阶段 5 补文件上传/删除;
- **action 命名**:`资源.动作`(如 `user.delete`、`user.assignRoles`、`role.assignPermissions`、`config.update`、`dictEntry.create`),集中登记在一个映射里与 description 模板对应,避免散落字符串;
- **失败也记**:业务校验失败(409/403/400 哨兵错误)记 `status=failed`,description 含原因摘要(如"删除角色 ops 失败:仍有用户绑定");意外 500 不记业务日志(归访问日志);
- **resource_id 统一字符串**,兼容非数字资源(如配置组用 group 名);
- 登录失败(`user_id=0`,username 记尝试的登录名)保留记录,便于发现撞库尝试。

### 接口(修订后)

| 方法                      | 路径                                           | 说明                                                        |
| ------------------------- | ---------------------------------------------- | ----------------------------------------------------------- |
| GET                       | /operation-logs                                | 业务日志分页;筛选 操作人/资源/动作/成败/时间范围            |
| GET / PUT                 | /configs/{group}                               | 读取/更新配置组(system: 站名、Logo URL;storage: 驱动与参数) |
| GET / POST / PUT / DELETE | /dicts、/dicts/{code}/items、/dicts/items/{id} | 字典与字典项 CRUD                                           |

契约变化:`OperationLogItem` 换为上述业务字段(去掉 method/path/statusCode/latencyMs),筛选参数换为 `username/resource/action/status + startTime/endTime`;权限码 `system:log:list` 不变。

server:业务日志表按新字段重建;各 service 在增删改方法落埋点;访问日志改文件输出 + 按天滚动清理;sys_configs、dicts/dict_items 不变;存储配置 MVP 仅保存不生效(阶段 5 消费)。

admin:日志页改为业务语义——列:操作人/动作/资源/描述/结果/IP/时间,筛选同步替换;详情抽屉同步;系统设置页与字典管理页不变。

验收:创建/删除用户后,日志页出现"创建用户 Bob(bob)""删除用户 Bob(bob)"等人话条目;查询操作不产生日志;HTTP 访问日志只在文件里,按天滚动且过期清理。**本阶段已按修订方案交付并验收**(e2e 断言业务文案,单测覆盖埋点与筛选)。

### 从旧方案回退(代码层,**已执行**)

- server:删 `httpapi.OperationLog` 中间件与 main 装配(Logging 中间件保留并加文件输出/清理);`operation_logs` 模型改业务字段(action 唯一新索引:`resource + resource_id`);新增 `internal/oplog`(Entry + Record);逐个 service 方法补埋点;登录失败在 auth service 记录;
- 契约:schema 与筛选参数改后 `pnpm gen:api`;
- admin:日志页列/筛选/抽屉替换;e2e 断言改为业务文案(如删除用户后出现对应 description)。

## 阶段 5:媒体资源管理(方案修订;**已交付并验收**)——整体可后置项已完成

> **方案修订说明**:原方案是通用"文件管理"页。修订为**两层架构**——底层仍是通用文件存储(支撑未来任何业务的文件需求),上层按媒体类型规划资源接口与信息提取;admin 只做图片管理、视频管理两个页面,不做通用文件管理页(使用方是运营人员,"文件"对他们没有意义,图片和视频才有)。

### 分层设计

- **底层(通用,无 UI)**:`files` 表 + `internal/storage` 接口(local 实现,目录来自 storage 配置组;预留 S3 实现位),负责文件的存取与介质删除。通用 `/files` CRUD 接口**暂不对外暴露**——后续非媒体业务(如附件)需要时再开放,避免运营侧出现无语义的文件列表;
- **上层(类型化)**:`media_assets` 表(kind = image / video / audio,file_id 关联 files,meta 存提取的信息);每种类型注册一个**信息提取器**(`Extractor` 接口):图片用 Go 标准库解析宽高与格式,视频/音频 MVP 只记基础信息并预留 ffprobe 接入位(时长、分辨率、封面帧等后续按需补充);
- 上传流程:`storage.Save → files 记录 → 提取器解析 → media_assets 记录`;删除媒体级联删除底层文件与介质;
- 文件内容统一走 `GET /files/{id}/content`(登录即可,流式输出),图片预览与视频播放共用,上层接口不重复提供下载。

### 接口(本期交付图片 + 视频;音频规划预留)

| 方法         | 路径                | 说明                                       |
| ------------ | ------------------- | ------------------------------------------ |
| POST         | /images             | multipart 上传,校验类型/大小,提取宽高/格式 |
| GET          | /images             | 分页列表(含 meta)                          |
| GET / DELETE | /images/{id}        | 详情 / 删除(级联底层文件)                  |
| POST         | /videos             | 同构上传(meta 预留时长/分辨率)             |
| GET          | /videos             | 分页列表                                   |
| GET / DELETE | /videos/{id}        | 详情 / 删除                                |
| GET          | /files/{id}/content | 文件内容流(登录即可)                       |

- 音频 `/audios` 与图片/视频同构,**规划预留**,本期不落契约——开放时同步 `media:audio:*` 权限点;
- 后续按类型扩展提取信息即扩展对应 Extractor,不影响底层与表结构;
- 权限码:`media:image:list/upload/delete`、`media:video:list/upload/delete`(menu 点 `menu:media:image` / `menu:media:video`);音频预留 `media:audio:*`。

server:`files`、`media_assets` 表;`internal/storage` 接口 + local 实现;上传大小上限 MVP 用常量(图片 10MB、视频 200MB),后续迁入 storage 配置组;系统设置页 Logo 升级为从图片库选择。

admin:图片管理页(网格缩略图 + 上传弹窗 + 预览大图 + 删除确认)、视频管理页(列表 + 上传弹窗 + 内嵌 video 播放 + 删除确认);**不做通用文件管理页**。

验收:上传图片后缩略图与大图预览正常且 meta 含宽高/格式;上传视频可内嵌播放;删除媒体后 files 记录与介质文件同步删除;非图片/视频类型(如 .txt)被对应接口以 400 拒绝;音频接口未开放。**本阶段已按修订方案交付并验收**(e2e 覆盖真实上传与展示;冒烟覆盖提取/级联删除/类型拒绝)。

## 种子数据

超管账号与超级管理员角色(全权限);初始菜单树(系统管理:用户/角色/菜单/日志/配置);示例字典(如 status 通用状态);初始站点配置。

## 跨阶段约定

- **契约先行**:每个接口先落 `openapi.yaml` → `pnpm gen:api` → 再写实现;禁止跳过契约直接写 handler/前端类型;
- **权限码命名**:`模块:资源:动作`,如 `system:user:create`;菜单权限码同规范;
- **每阶段 DoD**:`pnpm verify` 全绿、Swagger UI 可演示当阶段接口、无手写重复类型、种子数据可重建;
- JWT 登出不失效是 MVP 取舍,需要立即失效时再加黑名单(后续迭代);
- 阶段 5 未启动前,涉及文件的场景(如 Logo)一律用 URL 字段过渡。
