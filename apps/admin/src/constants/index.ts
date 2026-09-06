// 全局常量(见 docs/admin.md 的目录分区约定)。
export const SYSTEM_NAME = "CMS 管理后台";

export const TOKEN_STORAGE_KEY = "cms.admin.token";

// 后台网页挂在网关的 /admin 子路径下(见 docs/mvp-plan.md 阶段 8):
// 同时是路由 basename(runtime.config.ts)与 layout 剥离前缀的同一事实源。
export const APP_BASENAME = "/admin";
