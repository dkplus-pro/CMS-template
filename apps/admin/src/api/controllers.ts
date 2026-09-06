import { getAuth } from "./generated/auth/auth";
import { getSystem } from "./generated/system/system";

// Controller 绑定层:把 orval 按 tag 生成的工厂函数实例化为单例,
// 页面与 hooks 直接 SystemController.healthz() 调用(规范见 docs/admin.md)。
// 新增模块时在此追加一行绑定,禁止在 Controller 之外直接调用 getXxx() 工厂。
export const AuthController = getAuth();
export const SystemController = getSystem();
