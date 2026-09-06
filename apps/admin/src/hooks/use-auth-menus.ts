import { useQuery } from "@tanstack/react-query";

import type { AuthMenuNode } from "../api/generated/cMSAdminAPI.schemas";
import { AuthController } from "../api/controllers.gen";
import { queryKeys } from "../api/queryKeys";

export interface FlatMenu {
  id: number;
  parentId: number;
  name: string;
  path: string;
  componentKey?: string;
}

// 当前用户可见菜单树(动态路由与侧边栏的数据源,服务端已按权限过滤、排除隐藏项)。
export function useAuthMenus() {
  return useQuery({
    queryKey: queryKeys.auth.menus,
    queryFn: () => AuthController.getAuthMenus()
  });
}

export function flattenMenus(nodes: AuthMenuNode[]): FlatMenu[] {
  const flat: FlatMenu[] = [];
  const walk = (list: AuthMenuNode[]) => {
    for (const node of list ?? []) {
      flat.push({
        id: node.id,
        parentId: node.parentId,
        name: node.name,
        path: node.path,
        componentKey: node.componentKey ?? undefined
      });
      walk(node.children ?? []);
    }
  };
  walk(nodes ?? []);
  return flat;
}
