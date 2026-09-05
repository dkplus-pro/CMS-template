// 侧边栏菜单配置:静态兜底,阶段 3 起登录后按 /auth/menus 动态生成(见 docs/mvp-plan.md)。
export interface MenuConfig {
  path: string;
  title: string;
}

export const sidebarMenus: MenuConfig[] = [{ path: "/", title: "欢迎页" }];

// 按当前路径匹配选中菜单,未命中返回 null(如 404 页)。
export function matchSelectedKey(pathname: string): string | null {
  const hit = [...sidebarMenus]
    .sort((a, b) => b.path.length - a.path.length)
    .find((menu) => (menu.path === "/" ? pathname === "/" : pathname.startsWith(menu.path)));
  return hit ? hit.path : null;
}
