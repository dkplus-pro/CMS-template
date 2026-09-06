# Admin 开发规范

技术栈:Modern.js + React 19 + TypeScript + Arco Design(`@arco-design/web-react`)。

## 目录结构

分区必须一目了然,公共代码按类型归档,页面私有代码留在页面目录内:

```text
apps/admin/src/
  api/
    client.ts            手写:axios 实例 + orval mutator(唯一含横切逻辑的文件)
    controllers.ts       手写:Controller 绑定层,把 orval 工厂实例化为单例
    queryKeys.ts         手写:TanStack Query 的 queryKey 集中定义
    generated/           orval 生成物(类型 + 接口函数,勿手改)
  components/          公共组件(跨页面复用)
  hooks/               公共 hooks(跨页面复用的状态逻辑)
  routes/              页面层(Modern.js 约定路由,即 Page 层)
  store/               全局共享状态(Modern.js model)
  utils/               公共工具函数
  constants/           公共常量
  config/              公共配置(主题、路由菜单、queryClient 等)
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

- **服务端状态**(接口数据)一律使用 TanStack Query:页面/hooks 里 `useQuery` / `useMutation` + Controller 函数;**禁止手写 `useEffect` + `useState` 拉取接口**;QueryClient 单例在 `src/config/queryClient.ts`,由全局 layout 提供 Provider;
- **queryKey** 集中定义在 `src/api/queryKeys.ts`,结构为 `[模块, 资源, ...参数]`,与 Controller 模块一一对应,禁止在页面里裸写字符串 key;
- **客户端全局状态**(登录用户、菜单等)使用 Modern.js 自带 model(`@modern-js/runtime` 的 `useModel`),集中放 `src/store/`;
- 可复用的局部状态逻辑抽成 hooks(如 `useTableQuery` 封装"分页 + 筛选 + 请求"),放 `src/hooks/`;
- 允许使用 zustand,但一个项目里只用一种全局方案,不要混用。

## 工具库

- **请求类逻辑统一走 TanStack Query,不用 ahooks 的 `useRequest`**(一个项目只保留一套请求方案);
- **ahooks**:通用 React 逻辑(防抖节流、事件监听、生命周期等)优先使用 ahooks,组件里不手写这些通用逻辑;
- **lodash**:纯数据/集合操作优先使用 lodash;按方法引入控制体积:`import debounce from "lodash/debounce"`;
- ahooks 和 lodash 都覆盖不了的业务逻辑才自写,放 `src/hooks/`(带 React 状态)或 `src/utils/`(纯函数)。

## 接口与类型(orval 生成)

类型**和**接口函数都由 orval 从根 `openapi.yaml` 生成,前端不手写请求函数:

- **配置**:`apps/admin/orval.config.ts`,`input` 指向根 `openapi.yaml`,输出 `src/api/generated/`(`mode: tags-split`,按 tag/模块分文件);生成目录已在 eslint 与 prettier ignore,禁止手改;
- **mutator**:所有生成函数统一经 `src/api/client.ts` 的 `customInstance` 发起请求(配置在 `output.override.mutator`)。底层是 **axios** 实例:token 注入(request 拦截器)、401 处理、`{code, message, data}` 解包与错误 Message(response 拦截器)只写在这一处;若 orval 要求的 mutator 签名与现有函数不一致,在 `client.ts` 内加适配导出,不得把逻辑散落到别处;
- **函数名来自 operationId**:契约中每个接口必须写 operationId(它同时是后端 `ServerInterface` 方法名与前端生成函数名);axios 客户端在 tags-split 下按 tag 生成工厂函数(如 `getSystem().healthz()`),与后端按模块的 handler 结构对应;
- **只生成纯函数客户端**(调用返回 Promise),MVP 不启用 react-query / SWR / mocks 生成;后续若引入 `@tanstack/react-query`,改 orval 的 client 配置重新生成,页面调用方式平滑升级;
- **Controller 直调**:`src/api/controllers.ts` 把每个 tag 的 orval 工厂实例化为单例,页面与 hooks 统一 `SystemController.healthz()` 风格调用;**禁止在 Controller 之外直接调用 `getXxx()` 工厂**,新增模块在此追加一行绑定;
- **queryKey 集中管理**:见"状态管理"一节,新增接口在 `src/api/queryKeys.ts` 登记对应 key;
- 页面与 hooks 只 import `src/api` 的 Controller、queryKeys 与 `generated` 类型,**禁止手写与契约重复的接口类型**。

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
