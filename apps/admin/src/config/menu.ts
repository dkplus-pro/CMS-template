// 静态菜单声明(阶段 3 修订方案,见 docs/admin.md):
// 菜单结构与路由由前端代码声明,运行期按 /auth/me 下发的权限码过滤显隐。
// 权限码必须与服务端路由注册表(internal/httpapi/permission.go 的 Menu 字段)同名。
export interface MenuConfig {
  path: string;
  title: string;
  /** 所需权限码;未声明 = 登录即可见。 */
  permission?: string;
  children?: MenuConfig[];
}

export const sidebarMenus: MenuConfig[] = [
  { path: "/", title: "欢迎页" },
  {
    path: "/system",
    title: "系统管理",
    children: [
      { path: "/system/users", title: "用户管理", permission: "menu:system:user" },
      { path: "/system/roles", title: "角色管理", permission: "menu:system:role" }
    ]
  }
];

// 菜单可见判定(最小颗粒度):拥有菜单权限点本身,或该模块下任一 api 权限码
// (如 system:user:list)即视为可见,不要求完整勾选 menu:system:user。
export function hasMenuPermission(
  permission: string | undefined,
  permissions: string[] | undefined
): boolean {
  if (!permission) {
    return true;
  }
  if (!permissions?.length) {
    return false;
  }
  const modulePrefix = permission.replace(/^menu:/, "");
  return permissions.some(
    (code) => code === permission || code === modulePrefix || code.startsWith(`${modulePrefix}:`)
  );
}

// 按权限码过滤菜单:叶子按最小颗粒度判定,目录在任一子项可见时保留。
export function filterMenusByPermissions(
  menus: MenuConfig[],
  permissions: string[] | undefined
): MenuConfig[] {
  const result: MenuConfig[] = [];
  for (const menu of menus) {
    if (menu.children?.length) {
      const children = filterMenusByPermissions(menu.children, permissions);
      if (children.length) {
        result.push({ ...menu, children });
      }
      continue;
    }
    if (hasMenuPermission(menu.permission, permissions)) {
      result.push(menu);
    }
  }
  return result;
}

// 面包屑:按当前路径递归查找菜单标题,未命中返回 null(如 404 页)。
export function matchMenuTitle(
  pathname: string,
  menus: MenuConfig[] = sidebarMenus
): string | null {
  for (const menu of menus) {
    if (menu.path === pathname) {
      return menu.title;
    }
    if (menu.children) {
      const hit = matchMenuTitle(pathname, menu.children);
      if (hit) {
        return hit;
      }
    }
  }
  return null;
}
