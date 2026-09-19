import Taro from "@tarojs/taro";
import type { AxiosRequestConfig } from "axios";
import { API_BASE_URL } from "../config";
import { captureError, normalizeApiError } from "../core/monitor";
import { readErrorMessage, unwrapEnvelope } from "./envelope";

// 小程序端请求客户端(orval axios 客户端的 mutator,签名与 site 端一致:
// customInstance<T>(config: AxiosRequestConfig): Promise<T>)。
// 公开受众无会话,匿名端不做 token 注入与 401 跳转,只保留 {code, message, data} 解包与错误提示。
//
// 为什么直桥 Taro.request 而不是 axios + axios-miniprogram-adapter:
// 小程序运行时没有 XMLHttpRequest,axios 默认适配器不可用;社区适配器 axios-miniprogram-adapter
// 深度依赖 axios 0.x 内部模块(axios/lib/core/settle、axios/lib/core/createError 等),
// 而 axios 1.x 已删除 createError 且 exports 白名单不再暴露 ./lib/* 深路径,
// 与本项目钉定的 axios ^1.20.0 不兼容。因此这里仅复用 axios 的配置类型约定 mutator 签名,
// 传输层直接走 Taro.request(即 wx.request)。
//
// 只覆盖 orval 生成代码会用到的配置子集:url / method / params / data / headers / timeout。

type WeappMethod = "GET" | "POST" | "PUT" | "DELETE" | "HEAD" | "OPTIONS" | "TRACE" | "CONNECT";

function toWeappMethod(method: AxiosRequestConfig["method"]): WeappMethod {
  return (method ?? "GET").toUpperCase() as WeappMethod;
}

function toQueryString(params: unknown): string {
  if (params === null || typeof params !== "object") return "";
  const parts: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    const values = Array.isArray(value) ? value : [value];
    for (const item of values) {
      if (item === undefined || item === null) continue;
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(item))}`);
    }
  }
  return parts.join("&");
}

function buildRequestUrl(config: AxiosRequestConfig): string {
  const requestUrl = config.url ?? "";
  const isAbsolute = /^https?:\/\//i.test(requestUrl);
  const base = isAbsolute ? "" : API_BASE_URL.replace(/\/+$/, "");
  const path = [base, requestUrl.replace(/^\/+/, "")].filter((part) => part !== "").join("/");
  const query = toQueryString(config.params);
  if (query === "") return path;
  return path.includes("?") ? `${path}&${query}` : `${path}?${query}`;
}

function normalizeHeaders(headers: AxiosRequestConfig["headers"]): Record<string, string> {
  if (headers === undefined || headers === null) return {};
  if (typeof (headers as { toJSON?: unknown }).toJSON === "function") {
    return { ...(headers as unknown as { toJSON: () => Record<string, string> }).toJSON() };
  }
  return { ...(headers as Record<string, string>) };
}

// 韧性参数(N3):超时 10s 起步;幂等 GET 失败重试 1 次;错误统一挂钩 monitor(api_error)。
const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_GET_RETRIES = 1;

/** 请求失败载体:保留 statusCode 供重试判定与监控分类。 */
class RequestFailure extends Error {
  readonly statusCode?: number;

  constructor(message: string, statusCode?: number) {
    super(message);
    this.statusCode = statusCode;
  }
}

function requestOnce<T>(config: AxiosRequestConfig, method: WeappMethod, url: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    Taro.request({
      url,
      method,
      data: config.data,
      header: normalizeHeaders(config.headers),
      timeout: typeof config.timeout === "number" ? config.timeout : DEFAULT_TIMEOUT_MS,
      success: (response) => {
        const isOk = response.statusCode >= 200 && response.statusCode < 300;
        if (!isOk) {
          reject(new RequestFailure(readErrorMessage(response.data, response.statusCode), response.statusCode));
          return;
        }
        resolve(unwrapEnvelope<T>(response.data));
      },
      fail: (error) => {
        reject(new RequestFailure(error.errMsg || "网络请求失败"));
      }
    });
  });
}

// orval axios 客户端 mutator:生成代码调用 customInstance<T>(config),返回解包后的 data。
// 失败路径(网络/超时/信封错误)最终失败时挂钩 monitor(api_error),不影响异常语义。
export async function customInstance<T>(config: AxiosRequestConfig): Promise<T> {
  const method = toWeappMethod(config.method);
  const url = buildRequestUrl(config);
  const maxRetries = method === "GET" ? MAX_GET_RETRIES : 0;

  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      return await requestOnce<T>(config, method, url);
    } catch (error) {
      lastError = error;
      const statusCode = error instanceof RequestFailure ? error.statusCode : undefined;
      const transient = statusCode === undefined || statusCode >= 500;
      // 重试只给幂等 GET 的瞬时失败(网络/超时/5xx);4xx 业务错误重试无意义
      if (!(method === "GET" && transient) || attempt === maxRetries) {
        break;
      }
    }
  }

  const statusCode = lastError instanceof RequestFailure ? lastError.statusCode : undefined;
  const errMsg = lastError instanceof Error ? lastError.message : "请求失败";
  captureError(normalizeApiError({ endpoint: url, errMsg, code: statusCode }));
  throw lastError;
}
