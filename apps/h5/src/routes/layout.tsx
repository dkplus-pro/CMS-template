import { Outlet } from "@modern-js/runtime/router";

// 全局根布局:Modern.js 要求 routes/layout.tsx 必须存在(build 在缺失时直接报错,
// 见 docs/monorepo-expansion-plan.md 阶段 4 收口修复)。h5 占坑期无全局壳层,仅透出页面。
export default function H5Layout() {
  return <Outlet />;
}
