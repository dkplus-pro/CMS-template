import { PropsWithChildren } from "react";
import { useError, useLaunch, usePageNotFound, useUnhandledRejection } from "@tarojs/taro";

import { captureError, normalizeJsError, normalizePageNotFound, normalizeUnhandledRejection } from "./core/monitor";
import { mark } from "./core/perf";

import "./app.css";

function App({ children }: PropsWithChildren) {
  // 启动打点(N2.3):launch 时刻;首帧口径由页面侧 first_render 打点补充
  useLaunch(() => {
    mark("app.launch");
  });

  // 全局错误收口一行接线(N3):三类入口 → 规范化 → monitor facade,
  // 开关/采样/队列/上报通道全部由 core 决定,app 层不感知。
  useError((errorMessage) => captureError(normalizeJsError(errorMessage)));
  useUnhandledRejection((res) => captureError(normalizeUnhandledRejection(res)));
  usePageNotFound((res) => captureError(normalizePageNotFound(res)));

  // children 是将要会渲染的页面
  return children;
}

export default App;
