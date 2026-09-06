import Axios, { AxiosError, AxiosRequestConfig, AxiosResponse } from "axios";

// 公开站请求客户端(orval axios 客户端的 mutator,见 docs/multi-audience-contracts.md):
// 公开站无会话,token 注入与 401 跳转一概不做;只保留 {code, message, data} 解包与错误提示。
// 契约路径自带 /site/v1 前缀,页面与 dev 代理同域访问,无需 baseURL。

const axiosInstance = Axios.create();

function isEnvelope(
  payload: unknown
): payload is { code: number; message?: string; data: unknown } {
  return typeof payload === "object" && payload !== null && "code" in payload && "data" in payload;
}

axiosInstance.interceptors.response.use(
  (response) => {
    // 服务端 {code, message, data} 包装,这里统一解包,业务层直接拿 data。
    if (isEnvelope(response.data)) {
      response.data = response.data.data;
    }
    return response;
  },
  (error: AxiosError) => {
    console.error(readErrorMessage(error.response));
    return Promise.reject(error);
  }
);

function readErrorMessage(response?: AxiosResponse): string {
  const payload: unknown = response?.data;
  if (
    typeof payload === "object" &&
    payload !== null &&
    typeof (payload as { message?: unknown }).message === "string"
  ) {
    return (payload as { message: string }).message;
  }
  return `请求失败(${response?.status ?? "无响应"})`;
}

// orval axios 客户端 mutator:生成代码调用 customInstance<T>(config),返回解包后的 data。
export function customInstance<T>(config: AxiosRequestConfig): Promise<T> {
  return axiosInstance.request(config).then((response) => response.data as T);
}
