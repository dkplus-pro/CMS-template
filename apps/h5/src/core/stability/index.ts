// core/stability:稳定性能力占位(ErrorBoundary + 全局错误捕获 + 白屏检测,方案 §3)。
//
// 本卡(阶段 1.B)只落类型/接口占位与目录约定,组件与检测逻辑由阶段 2.C 实现:
// - TODO(阶段 2.C):error-boundary.tsx —— 根布局降级 UI,捕获渲染错误后经
//   core/monitor 的 Reporter 上报(core 内部互调允许);
// - TODO(阶段 2.C):global-error.ts —— window error/unhandledrejection/资源错误
//   全局捕获 → Reporter;
// - TODO(阶段 2.C):white-screen.ts —— 挂载超时根节点为空判定白屏 → 上报 + 降级。
//
// 依赖方向硬规则(同 core/monitor):core → config 允许;core 禁止 import routes/store。

/** 稳定性错误类别(阶段 2.C 各实现文件使用,与 core/monitor 的 kind 语义对齐)。 */
export type StabilityErrorKind = "render" | "global" | "resource" | "white-screen";

/** 稳定性错误载荷:形状与 core/monitor 的 ReportPayload 对齐,便于直接转发上报。 */
export interface StabilityError {
  kind: StabilityErrorKind;
  message: string;
  stack?: string;
  extra?: Record<string, unknown>;
}

/** 白屏检测入参(阶段 2.C 实现,先钉住形状便于单测)。 */
export interface WhiteScreenCheckOptions {
  /** 根节点选择器,默认按 Modern.js 挂载点传 "#root"。 */
  rootSelector: string;
  /** 挂载超时(毫秒),超时仍判空则视为白屏。 */
  timeoutMs: number;
}
