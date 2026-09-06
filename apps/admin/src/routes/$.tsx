import { useLocation } from "@modern-js/runtime/router";

import { componentRegistry } from "../config/component-registry";
import NotFoundPage from "../components/not-found";
import { flattenMenus, useAuthMenus } from "../hooks/use-auth-menus";

// 兜底路由 = 动态路由分发器:按当前路径在 /auth/menus 中查找菜单项,
// 用其 component_key 从白名单注册表渲染页面组件;未匹配则渲染 404。
// 服务端已按权限过滤该树,无权限的菜单在这里表现为 404。
export default function DynamicRoute() {
  const location = useLocation();
  const menusQuery = useAuthMenus();

  if (menusQuery.isPending) {
    return null;
  }

  const menu = flattenMenus(menusQuery.data ?? []).find((item) => item.path === location.pathname);
  const PageComponent = menu?.componentKey ? componentRegistry[menu.componentKey] : undefined;

  if (!PageComponent) {
    return <NotFoundPage />;
  }
  return <PageComponent />;
}
