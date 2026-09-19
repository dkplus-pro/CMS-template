import { useLoaderData } from "@modern-js/runtime/router";

import type { HomePageData } from "./page.data";

import "./page.css";

// ping 加载失败时的降级文案(loader 已把请求失败降级为 null,这里只兜渲染不空)。
const FALLBACK_PING_MESSAGE = "服务暂不可用,请稍后重试";

// 首页:服务端 loader 调 /api/h5/ping,渲染 ping 返回的 message(SSR 数据链路硬证据,
// 见 docs/monorepo-expansion-plan.md 阶段 3;数据流照抄 site 首页 useLoaderData 范式)。
export default function HomePage() {
  const ping = useLoaderData() as HomePageData;
  const message = ping?.message || FALLBACK_PING_MESSAGE;

  return (
    <main className="h5-home">
      <h1 className="h5-home-title">{message}</h1>
      <p className="h5-home-subtitle">活动 H5 占坑页:数据来自 /api/h5/ping(SSR loader)。</p>
    </main>
  );
}
