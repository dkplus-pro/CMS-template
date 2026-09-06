import { expect, test } from "@playwright/test";

test("admin requires login, then renders the landing page", async ({ page }) => {
  // 未登录访问业务页被守卫重定向到登录页。
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "CMS 管理后台" })).toBeVisible();

  // 错误口令被拒绝且停留在登录页。
  await page.getByPlaceholder("用户名").fill("admin");
  await page.getByPlaceholder("密码").fill("wrong-password");
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page.getByText("用户名或密码错误")).toBeVisible();

  // 种子管理员登录成功进入欢迎页,healthz 经代理连通。
  await page.getByPlaceholder("密码").fill("admin123");
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page.getByRole("heading", { name: /hello from the admin app/i })).toBeVisible();
  await expect(page.getByText("Turborepo + pnpm template")).toBeVisible();
  await expect(page.getByText("在线")).toBeVisible();

  // 顶栏显示当前用户昵称(/auth/me 数据)。
  await expect(page.getByText("管理员")).toBeVisible();

  // 兜底 404 页(arco Result 风格),返回首页可用。
  await page.goto("/no-such-page");
  await expect(page.getByText("抱歉,您访问的页面不存在")).toBeVisible();
  await page.getByRole("button", { name: "返回首页" }).click();
  await expect(page.getByRole("heading", { name: /hello from the admin app/i })).toBeVisible();

  // 用户管理:列表加载种子管理员,新建用户成功后出现在表格中。
  await page.getByText("用户管理").click();
  await expect(page.getByRole("cell", { name: "admin", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "新建用户" }).click();
  await page.getByPlaceholder("登录名").fill("bob");
  await page.getByPlaceholder("初始密码").fill("bob-123456");
  await page.getByPlaceholder("显示名", { exact: true }).nth(0).fill("Bob");
  await page.getByRole("button", { name: "确定" }).click();
  await expect(page.getByRole("cell", { name: "bob", exact: true })).toBeVisible();

  // 角色管理页面可达。
  await page.getByText("角色管理").click();
  await expect(page.getByRole("button", { name: "新建角色" })).toBeVisible();

  // 操作日志:e2e 前置流程已产生登录记录,表格应有数据。
  await page.getByText("操作日志").click();
  await expect(page.getByRole("cell", { name: "/auth/login" }).first()).toBeVisible();

  // 系统配置:种子站点名称可见。
  await page.getByText("系统配置").click();
  await expect(page.getByText("站点名称")).toBeVisible();

  // 字典管理:种子字典可见,选中后右侧字典项加载。
  await page.getByText("字典管理").click();
  await expect(page.getByRole("cell", { name: "common_status", exact: true })).toBeVisible();
  await page.getByRole("cell", { name: "common_status", exact: true }).click();
  await expect(page.getByRole("cell", { name: "启用" })).toBeVisible();

  // 退出登录回到登录页。
  await page.getByText("管理员", { exact: true }).click();
  await page.getByText("退出登录").click();
  await expect(page.getByRole("heading", { name: "CMS 管理后台" })).toBeVisible();
});
