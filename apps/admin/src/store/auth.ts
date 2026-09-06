import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { TOKEN_STORAGE_KEY } from "../constants";

interface AuthState {
  /** JWT,登录后写入;登出/过期清空(持久化到 localStorage,见 persist.name)。 */
  token: string | null;
  setToken: (token: string | null) => void;
}

// 客户端全局状态:认证信息。规范见 docs/admin.md——每个领域一个文件,命名 useXxxStore。
// 登录用户信息在阶段 1 落地,类型取自 orval 生成物,不在此手写。
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      setToken: (token) => set({ token })
    }),
    {
      name: TOKEN_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage)
    }
  )
);
