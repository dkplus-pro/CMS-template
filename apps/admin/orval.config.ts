import { defineConfig } from "orval";

// orval 生成配置:由根 openapi.yaml 生成类型与接口函数(规范见 docs/admin.md)。
// 生成物输出到 src/api/generated/,禁止手改;所有请求统一经 src/api/client.ts 的 mutator。
export default defineConfig({
  cms: {
    input: "../../openapi.yaml",
    output: {
      target: "./src/api/generated",
      mode: "tags-split",
      client: "fetch",
      override: {
        mutator: {
          path: "./src/api/client.ts",
          name: "customFetch"
        },
        fetch: {
          // 返回 data 本体而非 {data, status, headers} 包装,customFetch 直接返回解析后的 JSON;
          // 错误分支由 client.ts 的 customFetch 统一抛出,生成物不做状态码判断。
          forceSuccessResponse: true,
          includeHttpResponseReturnType: false
        }
      },
      clean: true
    }
  }
});
