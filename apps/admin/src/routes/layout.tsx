// React 19 下 Arco 的命令式 API(Message/Notification 等)必须先启用官方 react-19 适配器,
// 否则内部走已移除的 ReactDOM.render 报错(见 @arco-design/web-react es/_util/react-19-adapter)。
import "@arco-design/web-react/es/_util/react-19-adapter";
import {
  Avatar,
  Breadcrumb,
  ConfigProvider,
  Dropdown,
  Layout as ArcoLayout,
  Menu,
  Space
} from "@arco-design/web-react";
import { IconDown, IconUser } from "@arco-design/web-react/icon";
import { QueryClientProvider, useQuery, useQueryClient } from "@tanstack/react-query";
import zhCN from "@arco-design/web-react/es/locale/zh-CN";
import { Navigate, Outlet, useLocation, useNavigate } from "@modern-js/runtime/router";
import { useEffect, useState } from "react";

import { AuthController } from "../api/controllers.gen";
import { queryKeys } from "../api/queryKeys";
import { filterMenusByPermissions, matchMenuTitle, sidebarMenus } from "../config/menu";
import { queryClient } from "../config/queryClient";
import { APP_BASENAME, SYSTEM_NAME } from "../constants";
import { useAuthStore } from "../store/auth";

import PasswordModal from "../components/password-modal";
import "@arco-design/web-react/dist/css/arco.css";
import "./index.css";

const { Sider, Header, Content } = ArcoLayout;

// 全局根布局:Provider 必须在调用 useQuery 的组件之上,壳与守卫都放在 AppShell。
export default function Layout() {
  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider locale={zhCN}>
        <AppShell />
      </ConfigProvider>
    </QueryClientProvider>
  );
}

function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const routeQueryClient = useQueryClient();
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);

  // 应用内路径 = 剥离 basename 后的剩余段(URL /admin/{页面} 对应路由 {页面})。
  // 路由匹配(navigate/menu key/面包屑)全程用应用内路径,basename 由 router 统一叠加。
  const appPathname = location.pathname.startsWith(APP_BASENAME)
    ? location.pathname.slice(APP_BASENAME.length) || "/"
    : location.pathname;
  const isLoginPage = appPathname === "/login";

  const meQuery = useQuery({
    queryKey: queryKeys.auth.me,
    queryFn: () => AuthController.getMe(),
    enabled: Boolean(token) && !isLoginPage
  });

  // 当前用户信息属于服务端状态,查询成功后同步进 zustand,供顶栏直接读取。
  useEffect(() => {
    if (meQuery.data) {
      useAuthStore.getState().setUser(meQuery.data);
    }
  }, [meQuery.data]);

  // 侧边栏 = 静态菜单声明 × 当前用户权限码过滤(见 docs/admin.md 阶段 3 修订方案)。
  const visibleMenus = filterMenusByPermissions(sidebarMenus, user?.permissions);
  // 受控展开:SubMenu 的 defaultOpenKeys 只在挂载时读一次,而权限码异步就绪会导致
  // 挂载后才出现的 SubMenu 收不起/展不开,因此用受控 openKeys 全量展开目录。
  const [openKeys, setOpenKeys] = useState<string[]>([]);
  useEffect(() => {
    setOpenKeys(visibleMenus.filter((node) => node.children?.length).map((node) => node.path));
  }, [user?.permissions]);
  // 路由守卫:未登录访问业务页跳 /login,已登录访问 /login 跳首页。
  if (isLoginPage) {
    if (token) {
      return <Navigate to="/" replace />;
    }
    return <Outlet />;
  }
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  const currentTitle = matchMenuTitle(appPathname);

  const handleUserMenu = async (key: string) => {
    if (key === "password") {
      setPasswordModalVisible(true);
      return;
    }
    if (key === "logout") {
      try {
        await AuthController.logout();
      } finally {
        useAuthStore.getState().clear();
        routeQueryClient.clear();
        navigate("/login", { replace: true });
      }
    }
  };

  return (
    <>
      <ArcoLayout className="app-shell">
        <Sider className="app-sider" width={220}>
          <div className="app-logo">{SYSTEM_NAME}</div>
          <Menu
            selectedKeys={[appPathname]}
            openKeys={openKeys}
            onClickMenuItem={(key) => navigate(key)}
            style={{ width: "100%" }}
          >
            {visibleMenus.map((node) =>
              node.children?.length ? (
                <Menu.SubMenu key={node.path} title={node.title}>
                  {node.children.map((child) => (
                    <Menu.Item key={child.path}>{child.title}</Menu.Item>
                  ))}
                </Menu.SubMenu>
              ) : (
                <Menu.Item key={node.path}>{node.title}</Menu.Item>
              )
            )}
          </Menu>
        </Sider>
        <ArcoLayout>
          <Header className="app-header">
            <Breadcrumb>
              <Breadcrumb.Item>{SYSTEM_NAME}</Breadcrumb.Item>
              {currentTitle ? <Breadcrumb.Item>{currentTitle}</Breadcrumb.Item> : null}
            </Breadcrumb>
            <div className="app-header-right">
              <Dropdown
                position="br"
                droplist={
                  <Menu onClickMenuItem={handleUserMenu}>
                    <Menu.Item key="password">修改密码</Menu.Item>
                    <Menu.Item key="logout">退出登录</Menu.Item>
                  </Menu>
                }
              >
                <Space className="app-user">
                  <Avatar size={24}>
                    <IconUser />
                  </Avatar>
                  {user?.nickname || user?.username}
                  <IconDown />
                </Space>
              </Dropdown>
            </div>
          </Header>
          <Content className="app-content">
            <Outlet />
          </Content>
        </ArcoLayout>
      </ArcoLayout>
      <PasswordModal
        visible={passwordModalVisible}
        onClose={() => setPasswordModalVisible(false)}
      />
    </>
  );
}
