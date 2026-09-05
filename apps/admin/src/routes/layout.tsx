import { Breadcrumb, ConfigProvider, Layout as ArcoLayout, Menu } from "@arco-design/web-react";
import zhCN from "@arco-design/web-react/es/locale/zh-CN";
import { Outlet, useLocation, useNavigate } from "@modern-js/runtime/router";

import { matchSelectedKey, sidebarMenus } from "../config/menu";
import { SYSTEM_NAME } from "../constants";

import "@arco-design/web-react/dist/css/arco.css";
import "./index.css";

const { Sider, Header, Content } = ArcoLayout;

// 全局布局壳:侧边栏 + 顶栏 + 内容区,页面只写 Content 内的部分(见 docs/admin.md)。
export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const selectedKey = matchSelectedKey(location.pathname);
  const activeTitle = sidebarMenus.find((menu) => menu.path === selectedKey)?.title;

  return (
    <ConfigProvider locale={zhCN}>
      <ArcoLayout className="app-shell">
        <Sider className="app-sider" width={220}>
          <div className="app-logo">{SYSTEM_NAME}</div>
          <Menu
            selectedKeys={selectedKey ? [selectedKey] : []}
            onClickMenuItem={(key) => navigate(key)}
            style={{ width: "100%" }}
          >
            {sidebarMenus.map((menu) => (
              <Menu.Item key={menu.path}>{menu.title}</Menu.Item>
            ))}
          </Menu>
        </Sider>
        <ArcoLayout>
          <Header className="app-header">
            <Breadcrumb>
              <Breadcrumb.Item>{SYSTEM_NAME}</Breadcrumb.Item>
              {activeTitle ? <Breadcrumb.Item>{activeTitle}</Breadcrumb.Item> : null}
            </Breadcrumb>
          </Header>
          <Content className="app-content">
            <Outlet />
          </Content>
        </ArcoLayout>
      </ArcoLayout>
    </ConfigProvider>
  );
}
