import { Message } from "@arco-design/web-react";

import { TOKEN_STORAGE_KEY } from "../constants";

const BASE_URL = "/api";

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  /** 静默模式:失败时不弹全局提示,由调用方自行处理。 */
  silent?: boolean;
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setToken(token: string | null): void {
  if (token) {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  }
}

// 阶段 1 起服务端启用 {code, message, data} 响应包装,此处按有无 code/data 字段兼容两种形态。
function unwrap<T>(payload: unknown): T {
  if (payload && typeof payload === "object" && "code" in payload && "data" in payload) {
    return (payload as { data: T }).data;
  }
  return payload as T;
}

async function parseJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

// 统一请求客户端:baseURL /api、token 注入、401 清 token、错误统一 Message 提示。
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, silent = false } = options;

  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body)
    });
  } catch {
    const error = new Error("网络异常,请稍后重试");
    if (!silent) {
      Message.error(error.message);
    }
    throw error;
  }

  if (res.status === 401) {
    setToken(null);
    const error = new Error("登录已过期,请重新登录");
    if (!silent) {
      Message.error(error.message);
    }
    // 阶段 1 登录页上线后在此跳转 /login。
    throw error;
  }

  const payload = await parseJson(res);

  if (!res.ok) {
    const message =
      payload &&
      typeof payload === "object" &&
      typeof (payload as { message?: unknown }).message === "string"
        ? (payload as { message: string }).message
        : `请求失败(${res.status})`;
    if (!silent) {
      Message.error(message);
    }
    throw new Error(message);
  }

  return unwrap<T>(payload);
}
