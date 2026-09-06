# 接口与页面清单(MVP 全量核对表)

本清单是 [mvp-plan.md](./mvp-plan.md) 的落地核对表:接口的具体 schema 以 `openapi/admin.yaml` 契约为准(本清单只做索引,不复述字段),两者必须在同一个 PR 内同步演进。页面实现遵循 [admin.md](./admin.md);多受众契约说明见 [multi-audience-contracts.md](./multi-audience-contracts.md)。

## 通用约定

- **路径前缀**:契约路径不带 `/api` 前缀;admin 请求客户端 `baseURL = /api`,dev 代理把 `/api` rewrite 后转发到 server(8080);
- **认证**:`Authorization: Bearer <token>`;标注"免认证"的除外(/healthz、/auth/login、/swagger);
- **权限码**:标注"登录"表示仅需有效 token,其余按 RBAC 权限码校验(见下方权限点汇总);
- **分页**:入参 `page`、`pageSize`,返回 `{list, total}`;
- **错误码**:400 参数错误 / 401 未登录或 token 失效 / 403 无权限 / 404 资源不存在 / 409 业务冲突(用户名重复、角色仍被绑定等)/ 500 服务端错误。

## 接口清单(42 个)

### 公共(阶段 0:1 个)

| 方法 | 路径     | 说明     | 权限码 |
| ---- | -------- | -------- | ------ |
| GET  | /healthz | 健康检查 | 免认证 |

### auth 认证与账号(阶段 1:4 个;阶段 3:1 个)

| 方法 | 路径           | 说明                              | 权限码 |
| ---- | -------------- | --------------------------------- | ------ |
| POST | /auth/login    | 登录,返回 token、有效期、用户信息 | 免认证 |
| POST | /auth/logout   | 退出(MVP 前端清 token)            | 登录   |
| GET  | /auth/me       | 当前用户 + 角色 + 权限码          | 登录   |
| PUT  | /auth/password | 校验旧密码后修改                  | 登录   |

### users 用户(阶段 2:7 个)

| 方法   | 路径               | 说明                                   | 权限码             |
| ------ | ------------------ | -------------------------------------- | ------------------ |
| GET    | /users             | 分页;筛选 keyword(用户名/昵称)、status | system:user:list   |
| POST   | /users             | 新建;含初始密码与角色                  | system:user:create |
| GET    | /users/{id}        | 详情,含 roleIds                        | system:user:list   |
| PUT    | /users/{id}        | 编辑基础信息                           | system:user:update |
| DELETE | /users/{id}        | 删除(不可删自己/内置管理员)            | system:user:delete |
| PATCH  | /users/{id}/status | 启用/禁用(不可操作自己)                | system:user:update |
| PUT    | /users/{id}/roles  | 分配角色(全量覆盖)                     | system:user:assign |

### roles 角色 + permissions 权限点(阶段 2:8 个)

| 方法   | 路径                    | 说明                                        | 权限码             |
| ------ | ----------------------- | ------------------------------------------- | ------------------ |
| GET    | /roles                  | 分页;筛选 keyword、status                   | system:role:list   |
| GET    | /roles/all              | 全量(仅 id/code/name/status),供分配角色下拉 | 登录               |
| POST   | /roles                  | 新建角色                                    | system:role:create |
| GET    | /roles/{id}             | 详情                                        | system:role:list   |
| PUT    | /roles/{id}             | 编辑                                        | system:role:update |
| DELETE | /roles/{id}             | 删除(仍有用户绑定时 409)                    | system:role:delete |
| PUT    | /roles/{id}/permissions | 分配权限(permissionIds 全量覆盖)            | system:role:assign |
| GET    | /permissions            | 全量权限点树(menu + api)                    | system:role:assign |

### operation-logs 业务操作日志(阶段 4:1 个;方案见 mvp-plan.md 阶段 4 修订)

| 方法 | 路径            | 说明                                                                                               | 权限码          |
| ---- | --------------- | -------------------------------------------------------------------------------------------------- | --------------- |
| GET  | /operation-logs | 业务日志分页;筛选 username、resource、action、status、startTime/endTime;记录增删改与登录(查询不记) | system:log:list |

### configs 系统配置(阶段 4:2 个)

| 方法 | 路径             | 说明                           | 权限码               |
| ---- | ---------------- | ------------------------------ | -------------------- |
| GET  | /configs/{group} | 读取配置组(仅 system)          | system:config:list   |
| PUT  | /configs/{group} | 更新配置组(key-value 整组提交) | system:config:update |

### dicts 字典(阶段 4:10 个)

| 方法   | 路径                         | 说明                             | 权限码             |
| ------ | ---------------------------- | -------------------------------- | ------------------ |
| GET    | /dicts                       | 字典列表(全量,带 keyword 可选)   | system:dict:list   |
| POST   | /dicts                       | 新建字典                         | system:dict:create |
| PUT    | /dicts/{id}                  | 编辑字典                         | system:dict:update |
| DELETE | /dicts/{id}                  | 删除字典(级联删字典项)           | system:dict:delete |
| PATCH  | /dicts/{id}/status           | 字典上下线(启停)                 | system:dict:update |
| PUT    | /dicts/{id}/entries          | 整组覆写字典项(编辑弹窗一次保存) | system:dict:update |
| GET    | /dicts/{code}/items          | 某字典的字典项列表               | system:dict:list   |
| POST   | /dicts/{code}/items          | 新建字典项                       | system:dict:update |
| PUT    | /dicts/{code}/items/{itemId} | 编辑字典项                       | system:dict:update |
| DELETE | /dicts/{code}/items/{itemId} | 删除字典项                       | system:dict:update |

> 字典项不设独立权限码,统一归入 `system:dict:update`(字典管理页内的动作)。

### media 媒体资源(阶段 5,可后置;方案见 mvp-plan.md 阶段 5 修订:8 个 + content 1 个)

底层为通用文件存储(files + storage 接口),上层按类型化媒体接口暴露;admin 只做图片/视频管理,不做通用文件管理页。音频(/audios)规划预留,本期不落契约。

| 方法   | 路径                | 说明                                       | 权限码             |
| ------ | ------------------- | ------------------------------------------ | ------------------ |
| POST   | /images             | multipart 上传图片,提取宽高/格式           | media:image:upload |
| GET    | /images             | 分页列表(含 meta)                          | media:image:list   |
| GET    | /images/{id}        | 详情                                       | media:image:list   |
| DELETE | /images/{id}        | 删除(级联底层文件)                         | media:image:delete |
| POST   | /videos             | multipart 上传视频(meta 预留时长/分辨率)   | media:video:upload |
| GET    | /videos             | 分页列表                                   | media:video:list   |
| GET    | /videos/{id}        | 详情                                       | media:video:list   |
| DELETE | /videos/{id}        | 删除(级联底层文件)                         | media:video:delete |
| GET    | /files/{id}/content | 文件内容流(图片预览/视频播放共用;登录即可) | 登录               |

阶段 6(对象存储接入,方案见 mvp-plan.md)对本块的增量,端点与权限码不变:

- Image / Video 响应 schema 增加 `url` 字段(CDN 直链;local 存储为空串),admin 展示优先用 `url`,空串回退 content 端点;
- `GET /files/{id}/content` 对 `files.url` 非空的记录(OSS)改为 **302 重定向**到 CDN 地址,local 记录维持流式输出(保留 Range)。

## site 对外接口(阶段 7,公开只读)

契约在 `openapi/site.yaml`(与 admin 拆分,方案见 [multi-audience-contracts.md](./multi-audience-contracts.md)):路径自带 `/site/v1` 前缀,**无鉴权**、仅 GET、DTO 按对外裁剪、媒体字段直出 CDN 直链;响应信封约定与 admin 相同。公网网关只放行此前缀,后台路径仅内网。

| 方法 | 路径               | 说明                                       | 权限       |
| ---- | ------------------ | ------------------------------------------ | ---------- |
| GET  | /site/v1/site-info | 站点公开信息(站名/Logo,来自 system 配置组) | 公开(匿名) |

## 权限点汇总

- **api 权限点 27 个**(上表权限码去重):user 5、role 5、menu 4、log 1、config 2、dict 4、media 6;以 server 路由注册表为源,启动时 upsert 进 permissions(type=api);
- **menu 权限点**:与前端静态菜单一一对应,code 形如 `menu:system:user`,由服务端路由注册表在启动时创建,用于角色授权树分组与菜单显隐;
- 分配权限弹窗展示为一棵树:菜单节点(menu 点)下挂对应模块的 api 点。

## 页面清单(9 个业务页 + 登录页)

| 路由            | 页面           | 阶段      | 页面内弹窗/子组件                              | 依赖接口                  |
| --------------- | -------------- | --------- | ---------------------------------------------- | ------------------------- |
| /login          | 登录页         | 1         | —                                              | auth/login                |
| /               | 欢迎页(占位)   | 0         | —                                              | —                         |
| /system/users   | 用户管理       | 2         | 新建/编辑弹窗、分配角色弹窗、状态 Switch       | users 全部 7 个           |
| /system/roles   | 角色管理       | 2         | 新建/编辑弹窗、分配权限弹窗(Tree)              | roles 7 个 + /permissions |
| /system/logs    | 操作日志(业务) | 4         | 详情抽屉;列:操作人/动作/资源/描述/结果/IP/时间 | operation-logs            |
| /system/configs | 系统设置       | 4         | 站点信息(存储配置已迁环境变量,见阶段 6)        | configs 2 个              |
| /system/dicts   | 字典管理       | 4         | 字典表单弹窗、字典项表单弹窗(左右布局)         | dicts 8 个                |
| /media/images   | 图片管理       | 5(可后置) | 上传弹窗、预览大图                             | images 4 个 + content     |
| /media/videos   | 视频管理       | 5(可后置) | 上传弹窗、内嵌播放                             | videos 4 个 + content     |

全局件(不算独立页面):布局壳(侧边栏/顶栏/面包屑,阶段 0)、修改密码弹窗(阶段 1)、404 兜底路由与 403 无权限提示块(阶段 0/2)。

弹窗合计 9 个:用户×2、角色×2、字典×2、图片上传×1、视频上传×1、修改密码×1。

### 预判抽取的公共件(出现第二个用例即提升,见 admin.md 复用规则)

- `useTableQuery` — 列表页通用逻辑:分页 + 筛选参数 + 请求与刷新(users/roles/logs/files/dicts 共 5 处);
- `usePermission` / `<AuthButton>` — 按权限码控制按钮显隐(所有管理页);
- 表格操作列、状态 Tag 等,先在各页面私有实现,复用需求出现后再提升。

## 使用方式

1. 新增/变更接口:先改本清单 → 落 `openapi/admin.yaml`(对外站点接口落 `site.yaml`)→ `pnpm gen:api` → 前端直接调用生成函数(零手写)、后端补 handler/service/repo,清单与契约同一 PR;
2. 排期核对:阶段交付时按下表打勾——接口 42 个、页面 10 个路由(9 业务 + 登录)、弹窗 9 个;
3. 页面开发顺序 = 表格"依赖接口"列就绪即可开工,不依赖后端整体完成。
