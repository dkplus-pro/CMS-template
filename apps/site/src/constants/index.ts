// 过渡 shim:常量已迁入 src/config/site.ts(site P3 配置体系收口,见 docs/site-shell-plan.md
// 阶段 3.1)。因 src/routes/layout.tsx(并行任务卡互斥文件)仍从本模块导入 FALLBACK_SITE_NAME
// 而暂时保留;layout.tsx 的引用改为 "../config/site" 后应整体删除本目录。
export { COPYRIGHT_TEXT, FALLBACK_SITE_NAME, NAV_ITEMS } from "../config/site";
export type { NavItem } from "../config/site";
