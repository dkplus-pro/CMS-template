// core/monitor:错误/消息上报统一出口(方案 docs/h5-shell-plan.md §3)。
//
// 依赖方向硬规则(方案 §3,后续落 apps/h5/AGENTS.md):
// - core → config 允许;core 禁止 import routes/store;
// - 业务代码(routes/component)只允许经本目录导出的接口使用监控上报,
//   禁止直接 import @arms/rum-browser。
import { features } from "../../config/feature";

import { noopReporter } from "./noop";

/** 上报载荷:kind 区分事件类别(错误/资源/白屏等),message 写人话,stack/extra 可缺省。 */
export interface ReportPayload {
  kind: string;
  message: string;
  stack?: string;
  extra?: Record<string, unknown>;
}

/** 监控上报接口:阶段 2.A 由 arms.ts(@arms/rum-browser)提供默认实现。 */
export interface Reporter {
  captureError(payload: ReportPayload): void;
  captureMessage(payload: ReportPayload): void;
}

export { noopReporter };

// 默认实现占位:骨架阶段尚无真实实现,启用分支先回落 noop,保证可插拔。
// TODO(阶段 2.A):替换为 arms.ts 的 ARMS 实现(动态 import、SSR 安全、按采样率上报)。
const defaultReporter: Reporter = noopReporter;

// 当前实例选择逻辑:未启用返回 noop,业务侧拿到的 Reporter 恒可用、无需判空。
export function getReporter(): Reporter {
  return features.monitor ? defaultReporter : noopReporter;
}
