# Site 开发规范(对外网站)

本文是对外网站 app(`apps/site`)的开发规范全集,与 [admin 开发规范](./admin.md)、
[server 开发规范](./server.md) 平级;仓库通用规则见 [development.md](./development.md)。
site 由 Modern.js SSR(appTools + `server.ssr: true`)驱动,消费 `openapi/site.yaml`
公开契约(见 [multi-audience-contracts.md](./multi-audience-contracts.md))。

## 目录结构

```text
apps/site/
  modern.config.ts      SSR/端口/dev 代理/html 配置
  orval.config.ts       由 openapi/site.yaml 生成接口函数(与 admin 同款流水线)
  src/
    api/                client.ts(mutator)/ controllers.gen.ts(绑定层)/ generated/(生成物,禁手改)
    components/         跨页面复用组件(site-header / site-footer …)
    hooks/              复用 hooks(use-breakpoint …)
    store/              zustand 客户端全局状态(每个领域一个 useXxxStore)
    constants/          全局常量(版权文案、导航项等)
    config/             运行时配置装配(如 RUM 初始化参数)
    utils/              纯数据操作工具
    routes/             文件路由:layout.tsx(根布局)/ page.tsx(首页)/ $.tsx(404 兜底)
                        及同名的 .data.ts(loader,服务端数据加载)
  tests/                Vitest + RTL 用例(见「测试」)
```

- `api/` 生成物与绑定层由 `pnpm gen:api` 生成,禁止手改;前端接口函数一律经
  `client.ts` 的 mutator(orval `customInstance`),不在页面手写请求函数;
- `src/config`、`src/utils` 为预留分区,出现首个真实文件后删除 `.gitkeep`。

## 接口契约

- site 只消费 `openapi/site.yaml`(`/api/site/*`,只读公开接口);改接口先改契约再
  `pnpm gen:api`,两侧不允许出现与契约不一致的手写类型(与 admin 同纪律);
- `client.ts` 双端 baseURL 规则:SSR 服务端进程内无"同源"概念,用绝对地址
  (env `SITE_API_BASE`,默认 `http://127.0.0.1:8080`);浏览器端保持空串走同源
  相对路径(dev 由 Modern.js 代理 `/api`,生产由网关同域转发)。SSR 环境判断统一用
  `typeof window === "undefined"`;
- 公开站无会话:client 不做 token 注入、不做 401 跳转,只保留 `{code, message, data}`
  信封解包与错误 console。

## 数据加载(SSR)

- 数据加载统一用 Modern.js App Router 的 loader 约定:`src/routes/*.data.ts` 具名导出
  `loader`,SSR 下在服务端执行,数据随 HTML 下发、客户端 hydration 复用;组件内用
  `useLoaderData()`(从 `@modern-js/runtime/router` 导入,react-router 7 语义)读取;
- **loader 内不得引用任何客户端状态**(window/localStorage/zustand 均禁止);
- loader 必须自捕获请求失败(try/catch 返回 `null` 降级),服务端接口故障不得阻断
  整页 SSR 渲染,组件对 `null` 渲染兜底文案;
- 服务端数据不进 zustand:loader 拉取的数据只经 `useLoaderData` 消费;当前 layout 与
  首页各拉一次 site-info(页面主视觉自持数据),栏目页增多后可合并到 layout 一处。

## 状态管理

- 客户端全局状态用 zustand(`src/store/`,每个领域一个 `useXxxStore`),如移动端
  菜单开合 `useUiStore`;
- 服务端状态一律走 loader,禁止 useEffect 手动拉接口、禁止 ahooks 的 useRequest。

## UI 与响应式

- UI 优先用 `@arco-design/web-react` 基础组件;React 19 下必须在根布局顶部引入
  `@arco-design/web-react/es/_util/react-19-adapter`(与 admin 同做法);
- **响应式双端适配是硬要求**:每个页面的布局、导航、字号必须在 mobile(< 768px)与
  desktop(≥ 768px)双端可用;断点与 Arco Grid 的 md(768px)对齐,统一经
  `src/hooks/use-breakpoint.ts` 的 `useIsMobile()` 判断(matchMedia 实现);
- 断点判定 hook 必须对 SSR 安全:服务端固定按桌面渲染,挂载后再同步真实断点,
  保证 hydration 无告警;
- 复用规则:2 个及以上页面用 → 提到 `src/components`、`src/hooks`;单页面用 →
  留在页面目录内;
- 单文件超约 300 行必须拆分,页面主入口只做数据编排。

## 测试

- 单元/组件:Vitest + React Testing Library + jsdom(配置 `vitest.config.ts` 与
  `tests/setup.ts`,与 admin 同构);`window.matchMedia`、`ResizeObserver` 等 jsdom
  缺失 API 在 setup 补 shim;生成物不写用例;
- E2E:Playwright(根 `playwright.config.ts` 的 site project,dev 端口 18081,
  `API_PROXY_TARGET` 指向 e2e Go server);SSR 用 `javaScriptEnabled: false` 的
  硬证据用例固化;
- **计划期测试用例纪律**:做计划时必须先列出测试用例清单与边界条件(空值/零值/
  越界/权限缺失/网络失败/非法状态迁移六类必查),实现提交与用例同批交付。

## 安全

### XSS

- SSR 输出由 React 转义,业务代码**禁止使用 `dangerouslySetInnerHTML`**;富文本需求
  出现时先引 DOMPurify 消毒,并在评审中单独说明;
- 外部/媒体 URL 渲染前限定 `http(s)` 协议;
- 生产构建注入 CSP meta(`modern.config.ts` html 配置,仅生产;SSR 会内联 loader 数据
  script,起步用 `script-src 'self' 'unsafe-inline'`,nonce 化列 TODO);托管层响应头
  CSP 为权威配置,meta 为兜底。

### CSRF

- site 契约全部为 GET 公开只读、无 Cookie 无会话,CSRF **结构性不适用**
  (与 admin 的 Bearer 结论同理,见 docs/server.md「CSRF 与会话安全」);
- **约束**:site 未来新增写接口时,必须在 site 链挂 `OriginCheck` 中间件
  (server 阶段 10 已有,复用)且不得引入 Cookie 会话,二者缺一不得合并。

## 监控(RUM)

- 阿里云 ARMS 用户体验监控:`@arms/rum-browser`,初始化代码在 `src/config/rum.ts`,
  根布局客户端侧调用;
- 初始化条件:`typeof window !== "undefined"`(仅客户端)+ **动态 import** 不阻塞首屏 +
  env `RUM_ENDPOINT` 与 `RUM_PID` 均存在,任一缺失即不初始化——**dev 默认关闭**,
  生产部署注入(占位见 `apps/site/.env.example`);`spaMode: "history"`,
  `version` 取应用版本;
- **客户端配置走构建期内联**(`modern.config.ts` 的 `source.define` 把
  `process.env.RUM_*` 内联为字面量——浏览器无 `process`,裸 `process.env` 引用会
  ReferenceError):部署时 RUM 变量须在**构建(CI)阶段**注入,仅运行时注入对浏览器端无效;
- 上报内容:PV、JS 错误、Web 性能(SDK 默认采集),不做自定义埋点。

## 环境变量

- `SITE_API_BASE` — SSR 服务端请求 Go server 的绝对地址(默认 `http://127.0.0.1:8080`);
- `API_PROXY_TARGET` — dev 代理目标(默认 `http://localhost:8080`);
- `RUM_ENDPOINT` / `RUM_PID` — RUM 上报端点与站点 PID(均缺失则不初始化;构建期内联,须构建时注入);
- 占位见 `apps/site/.env.example`;`.env.*` 已 gitignore,禁止提交真实密钥。
