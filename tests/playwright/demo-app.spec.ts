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

  // 退出登录回到登录页。
  await page.getByText("管理员").click();
  await page.getByText("退出登录").click();
  await expect(page.getByRole("heading", { name: "CMS 管理后台" })).toBeVisible();
});
