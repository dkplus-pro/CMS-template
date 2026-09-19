import { Outlet } from "@modern-js/runtime/router";

import { shareConfig } from "../config/share";

// 全局根布局:Modern.js 要求 routes/layout.tsx 必须存在(build 在缺失时直接报错,
// 见 docs/monorepo-expansion-plan.md 阶段 4 收口修复)。h5 占坑期无全局壳层,仅透出页面。
//
// 分享/SEO 槽位(阶段 2.C):消费 config/share.ts,经 React 19 head 标签提升把
// <title>/meta description/og:image 写入 <head>(SSR 与浏览器同规则,渲染确定性一致,无 hydration 分歧);
// modern.config.ts 的 html.title 是构建期兜底,取值须与 shareConfig.title 保持一致。
// 微信 JSSDK 分享只留配置位(wechatShareSlot),TODO 见 config/share.ts,接入时在客户端动态加载。
export default function H5Layout() {
  return (
    <>
      <title>{shareConfig.title}</title>
      <meta name="description" content={shareConfig.description} />
      {shareConfig.ogImage !== "" ? (
        <meta property="og:image" content={shareConfig.ogImage} />
      ) : null}
      <Outlet />
    </>
  );
}
