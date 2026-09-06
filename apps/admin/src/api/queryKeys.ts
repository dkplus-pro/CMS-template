// TanStack Query 的 queryKey 集中定义(规范见 docs/admin.md):
// 结构为 [模块, 资源, ...参数],与 Controller 模块一一对应,禁止在页面里裸写字符串 key。
export const queryKeys = {
  system: {
    healthz: ["system", "healthz"] as const
  }
};
