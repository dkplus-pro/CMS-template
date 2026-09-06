import type { ComponentType } from "react";

import UsersPage from "../pages/system/users";
import RolesPage from "../pages/system/roles";
import MenusPage from "../pages/system/menus";

// 页面组件白名单(见 docs/admin.md):动态路由按菜单的 component_key 从这里取组件,
// 后端不下发文件路径;key 与 menus 表的 component_key 一致。
export const componentRegistry: Record<string, ComponentType> = {
  welcome: () => null, // 欢迎页为静态路由(/),此处仅占位
  "system/users": UsersPage,
  "system/roles": RolesPage,
  "system/menus": MenusPage
};
