# Admin 开发规范

技术栈:Modern.js + React 19 + TypeScript + Arco Design(`@arco-design/web-react`)。

## 目录结构

分区必须一目了然,公共代码按类型归档,页面私有代码留在页面目录内:

```text
apps/admin/src/
  api/                 openapi 生成物 + 请求客户端(生成物勿手改)
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

## 接口与类型

- 类型与请求由 `pnpm gen:api` 从根 `openapi.yaml` 生成到 `src/api/`;
- **禁止手写与生成物重复的接口类型**;组件、hooks 一律引用 `src/api` 里的类型;
- 请求客户端统一封装(fetch 拦截器处理鉴权、错误提示),页面不直接裸调 fetch。

## 复用与拆分

复用判断标准(硬性规则):

| 场景               | 位置                                 |
| ------------------ | ------------------------------------ |
| 2 个及以上页面使用 | `src/components/`、`src/hooks/`      |
| 仅单个页面使用     | 页面目录内的 `components/`、`hooks/` |
| 跨页面全局共享状态 | `src/store/`(Modern.js model)        |
| 接口类型           | 一律复用 `src/api/` 生成物           |

拆分规则:

- 单文件超过约 **300 行**必须拆分;
- 页面主入口(`page.tsx`)保持"数据编排"角色,查询表单、表格列渲染、弹窗拆成子文件;
- 为页面拓展留位:列表页的查询条件、表格列以配置数组描述,新增字段改配置而非改结构。
