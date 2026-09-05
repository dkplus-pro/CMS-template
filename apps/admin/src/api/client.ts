import { Message } from "@arco-design/web-react";

import { TOKEN_STORAGE_KEY } from "../constants";

// 统一请求客户端(orval fetch 客户端的 mutator,见 docs/admin.md):
// baseURL 拼接、token 注入、401 处理、错误提示、{code, message, data} 解包全部只写在这里,
// 生成物不含任何横切逻辑,生成函数拿到的直接是 data 本体。

const BASE_URL = "/api";

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

function isEnvelope(
  payload: unknown
): payload is { code: number; message?: string; data: unknown } {
  return typeof payload === "object" && payload !== null && "code" in payload && "data" in payload;
}

async function readErrorMessage(res: Response): Promise<string> {
  try {
    const payload: unknown = await res.json();
    if (
      typeof payload === "object" &&
      payload !== null &&
      typeof (payload as { message?: unknown }).message === "string"
    ) {
      return (payload as { message: string }).message;
    }
  } catch {
    // 响应体不是 JSON,走通用文案。
  }
  return `请求失败(${res.status})`;
}

// orval fetch 客户端 mutator:签名与全局 fetch 对齐,额外承担解析与解包,返回 Promise<T>。
export async function customFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  const token = getToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${url}`, { ...options, headers });
  } catch (error) {
    Message.error("网络异常,请稍后重试");
    throw error;
  }

  if (res.status === 401) {
    setToken(null);
    Message.error("登录已过期,请重新登录");
    // 阶段 1 登录页上线后在此跳转 /login。
    throw new Error("登录已过期,请重新登录");
  }

  if (!res.ok) {
    const message = await readErrorMessage(res);
    Message.error(message);
    throw new Error(message);
  }

  const payload: unknown = await res.json().catch(() => null);
  return (isEnvelope(payload) ? payload.data : payload) as T;
}
