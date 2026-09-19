import react from "@vitejs/plugin-react";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";

// electron-vite 三段配置(main / preload / renderer),默认输出 out/{main,preload,renderer}。
// 渲染层 dev server 端口 18083,并把 /api 同源代理到 Go server(http://127.0.0.1:18085,
// 与 site/h5 的联调方式一致);客户端 axios baseURL 留空,dev 靠该代理、生产靠网关同域转发。
export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    // 注意:NodeNext 解析下命中该包的 CJS 导出重载(options 为必填),不能以无参形式调用。
    plugins: [react({})],
    server: {
      port: 18083,
      proxy: {
        "/api": {
          target: "http://127.0.0.1:18085",
          changeOrigin: true
        }
      }
    }
  }
});
