import { request } from "./client";
import type { components } from "./schema.gen";

// 类型一律来自 openapi.yaml 生成物,禁止手写重复类型(见 docs/admin.md)。
export type HealthzResponse = components["schemas"]["HealthzResponse"];

export function healthz(options?: { silent?: boolean }) {
  return request<HealthzResponse>("/healthz", { silent: options?.silent });
}
