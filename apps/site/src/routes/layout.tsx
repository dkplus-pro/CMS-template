// React 19 下 Arco 的命令式 API 必须先启用官方 react-19 适配器(与 admin 同做法,
// 见 admin/src/routes/layout.tsx);放在根布局顶部保证所有 Arco 组件之前执行。
import "@arco-design/web-react/es/_util/react-19-adapter";
import { ConfigProvider } from "@arco-design/web-react";
import zhCN from "@arco-design/web-react/es/locale/zh-CN";
import { Outlet, useLoaderData } from "@modern-js/runtime/router";

import SiteFooter from "../components/site-footer";
import SiteHeader from "../components/site-header";
import { useRum } from "../config/rum";
import { FALLBACK_SITE_NAME } from "../constants";
import type { SiteLayoutData } from "./layout.data";

import "@arco-design/web-react/dist/css/arco.css";
import "./layout.css";

// 全局根布局:页头(站名/Logo/导航,数据来自本路由的 layout.data loader)+ 页面 + 页脚。
export default function SiteLayout() {
  // RUM 仅客户端初始化(useEffect 不在 SSR 执行;env 缺失时为 no-op)。
  useRum();
  const siteInfo = useLoaderData() as SiteLayoutData;
  const siteName = siteInfo?.siteName || FALLBACK_SITE_NAME;

  return (
    <ConfigProvider locale={zhCN}>
      <div className="site-shell">
        <SiteHeader siteName={siteName} logoUrl={siteInfo?.logoUrl || undefined} />
        <div className="site-main">
          <Outlet />
        </div>
        <SiteFooter />
      </div>
    </ConfigProvider>
  );
}
