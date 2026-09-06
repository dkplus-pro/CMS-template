import { Message } from "@arco-design/web-react";
import Axios, { AxiosError, AxiosRequestConfig, AxiosResponse } from "axios";

import { useAuthStore } from "../store/auth";

// 统一请求客户端(orval axios 客户端的 mutator,见 docs/admin.md):
// 底层为 axios 实例;契约路径已字面带 /api/admin 前缀(见 docs/mvp-plan.md 阶段 8),
// 这里不设 baseURL;token 注入、401 处理、错误提示、{code, message, data} 解包
// 全部只写在这里,生成物不含任何横切逻辑,生成函数拿到的直接是 data 本体。
// token 的读写委托给 zustand 的 useAuthStore(客户端全局状态,见 src/store/auth.ts)。

function isEnvelope(
  payload: unknown
): payload is { code: number; message?: string; data: unknown } {
  return typeof payload === "object" && payload !== null && "code" in payload && "data" in payload;
}

const axiosInstance = Axios.create();

axiosInstance.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

axiosInstance.interceptors.response.use(
  (response) => {
    // 服务端启用 {code, message, data} 包装后,这里统一解包,业务层直接拿 data。
    if (isEnvelope(response.data)) {
      response.data = response.data.data;
    }
    return response;
  },
  (error: AxiosError) => {
    // 登录接口自身的 401 是"凭证错误",不属于会话过期,交给通用错误分支提示。
    const isLoginRequest = error.config?.url?.includes("/auth/login");
    if (error.response?.status === 401 && !isLoginRequest) {
      useAuthStore.getState().clear();
      Message.error("登录已过期,请重新登录");
      // 阶段 1 登录页上线后在此跳转 /login。
    } else if (error.response) {
      Message.error(readErrorMessage(error.response));
    } else {
      Message.error("网络异常,请稍后重试");
    }
    return Promise.reject(error);
  }
);

function readErrorMessage(response: AxiosResponse): string {
  const payload: unknown = response.data;
  if (
    typeof payload === "object" &&
    payload !== null &&
    typeof (payload as { message?: unknown }).message === "string"
  ) {
    return (payload as { message: string }).message;
  }
  return `请求失败(${response.status})`;
}

// orval axios 客户端 mutator:生成代码调用 customInstance<T>(config),返回解包后的 data。
export function customInstance<T>(config: AxiosRequestConfig): Promise<T> {
  return axiosInstance.request(config).then((response) => response.data as T);
}
