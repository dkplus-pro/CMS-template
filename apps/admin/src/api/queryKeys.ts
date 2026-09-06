import type { ListOperationLogsStatus } from "../api/generated/cMSAdminAPI.schemas";

// TanStack Query 的 queryKey 集中定义(规范见 docs/admin.md):
// 结构为 [模块, 资源, ...参数],与 Controller 模块一一对应,禁止在页面里裸写字符串 key。
export const queryKeys = {
  auth: {
    me: ["auth", "me"] as const
  },
  system: {
    healthz: ["system", "healthz"] as const
  },
  users: {
    list: (page: number, pageSize: number, keyword: string, status?: boolean) =>
      ["users", "list", { page, pageSize, keyword, status }] as const
  },
  roles: {
    list: (page: number, pageSize: number, keyword: string, status?: boolean) =>
      ["roles", "list", { page, pageSize, keyword, status }] as const,
    all: ["roles", "all"] as const
  },
  permissions: {
    tree: ["permissions", "tree"] as const
  },
  logs: {
    list: (
      page: number,
      pageSize: number,
      username: string,
      resource?: string,
      action?: string,
      status?: ListOperationLogsStatus,
      range?: [string, string]
    ) => ["logs", "list", { page, pageSize, username, resource, action, status, range }] as const
  },
  configs: {
    group: (group: string) => ["configs", group] as const
  },
  dicts: {
    list: (keyword: string) => ["dicts", "list", { keyword }] as const,
    items: (code: string) => ["dicts", "items", code] as const
  }
};
