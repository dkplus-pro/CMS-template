# Admin 开发规范

技术栈:Modern.js + React 19 + TypeScript + Arco Design(`@arco-design/web-react`)。

## 目录结构

分区必须一目了然,公共代码按类型归档,页面私有代码留在页面目录内:

```text
apps/admin/src/
  api/
    client.ts            手写:统一请求客户端(orval mutator 入口,唯一允许手写的文件)
    generated/           orval 生成物(类型 + 接口函数,勿手改)
  components/          公共组件(跨页面复用)
  hooks/               公共 hooks(跨页面复用的状态逻辑)
  routes/              页面层(Modern.js 约定路由,即 Page 层)
  store/               全局共享状态(Modern.js model)
  utils/               公共工具函数
  constants/           公共常量
  config/              公共配置(主题、路由菜单等)
```

页面内部同样分区(领域一个目录):

```text
src/routes/article/
  page.tsx             列表页主入口
  detail.page.tsx      详情页
  components/          页面私有组件(编辑弹窗等)
  hooks/               页面私有 hooks(useArticleList 等)
```

命名:组件文件 PascalCase;hooks 以 `use` 开头;常量 SCREAMING_SNAKE;其余 camelCase。

## UI 规范

- **组件优先级**:一律优先使用 Arco Design 基础组件,确实不满足再自定义,以降低维护成本;
- **页面风格**:照抄 [Arco Design Pro 列表页](https://react-pro.arco.design/list/search-table) 的成熟范式:
  - 列表页 = `Card` + 查询 `Form` + `Table` + `Pagination`;
  - 详情页 = `PageHeader` / `Descriptions`;
  - 新建编辑 = `Modal` + `Form`(简单场景不单独开页面);
- 主题色、圆角等走 Arco 的 `ConfigProvider` token 定制,组件内不写死颜色;
- 布局(侧边栏 + 顶栏 + 内容区)在全局 layout 中实现一次,页面只写内容区。

## 状态管理

- 全局共享状态(登录用户、菜单等)使用 Modern.js 自带 model(`@modern-js/runtime` 的 `useModel`),集中放 `src/store/`;
- 可复用的局部状态逻辑抽成 hooks(如 `useTableQuery` 封装"分页 + 筛选 + 请求"),放 `src/hooks/`;
- 允许使用 zustand,但一个项目里只用一种全局方案,不要混用。

## 接口与类型(orval 生成)

类型**和**接口函数都由 orval 从根 `openapi.yaml` 生成,前端不手写请求函数:

- **配置**:`apps/admin/orval.config.ts`,`input` 指向根 `openapi.yaml`,输出 `src/api/generated/`(`mode: tags-split`,按 tag/模块分文件);生成目录已在 eslint 与 prettier ignore,禁止手改;
- **mutator**:所有生成函数统一经 `src/api/client.ts` 的 `customInstance` 发起请求(配置在 `output.override.mutator`)。底层是 **axios** 实例:token 注入(request 拦截器)、401 处理、`{code, message, data}` 解包与错误 Message(response 拦截器)只写在这一处;若 orval 要求的 mutator 签名与现有函数不一致,在 `client.ts` 内加适配导出,不得把逻辑散落到别处;
- **函数名来自 operationId**:契约中每个接口必须写 operationId(它同时是后端 `ServerInterface` 方法名与前端生成函数名);axios 客户端在 tags-split 下按 tag 生成工厂函数(如 `getSystem().healthz()`),与后端按模块的 handler 结构对应;
- **只生成纯函数客户端**(调用返回 Promise),MVP 不启用 react-query / SWR / mocks 生成;后续若引入 `@tanstack/react-query`,改 orval 的 client 配置重新生成,页面调用方式平滑升级;
- 页面与 hooks 只 import `src/api/generated` 的函数和类型,**禁止手写与契约重复的接口类型**。

新增接口动作:改 `openapi.yaml` → `pnpm gen:api` → 前端直接调用生成函数(零手写)。

## 复用与拆分

复用判断标准(硬性规则):

| 场景               | 位置                                 |
| ------------------ | ------------------------------------ |
| 2 个及以上页面使用 | `src/components/`、`src/hooks/`      |
| 仅单个页面使用     | 页面目录内的 `components/`、`hooks/` |
| 跨页面全局共享状态 | `src/store/`(Modern.js model)        |
| 接口类型与请求函数 | 一律复用 `src/api/generated/` 生成物 |

拆分规则:

- 单文件超过约 **300 行**必须拆分;
- 页面主入口(`page.tsx`)保持"数据编排"角色,查询表单、表格列渲染、弹窗拆成子文件;
- 为页面拓展留位:列表页的查询条件、表格列以配置数组描述,新增字段改配置而非改结构。
