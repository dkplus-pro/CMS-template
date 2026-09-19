// core/track:页面 PV 与自定义事件埋点统一出口(方案 docs/h5-shell-plan.md §3)。
//
// 依赖方向硬规则(同 core/monitor):core → config 允许;core 禁止 import routes/store;
// 业务代码只允许经本目录接口埋点,禁止直连上报 SDK/远端端点。
import { features } from "../../config/feature";

import { consoleTracker } from "./console";

/** 埋点接口:pageView 记页面浏览(payload 常见 path 等),event 记自定义事件。 */
export interface Tracker {
  pageView(payload?: Record<string, unknown>): void;
  event(name: string, payload?: Record<string, unknown>): void;
}

export { consoleTracker, PAGE_VIEW_EVENT } from "./console";

// no-op 实现:未启用(TRACK_ENDPOINT 未配置)时丢弃一切埋点,幂等不抛错。
export const noopTracker: Tracker = {
  pageView: () => undefined,
  event: () => undefined
};

// 当前实例选择逻辑:未启用走 no-op;启用分支骨架阶段先用 console 本地观测。
// TODO(阶段 2.B):启用分支接入远端上报实现(arms.ts),console 实现保留为本地观测兜底。
export function getTracker(): Tracker {
  return features.track ? consoleTracker : noopTracker;
}
