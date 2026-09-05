import { expect, test } from "@playwright/test";

test("admin app renders hello world landing page", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /hello from the admin app/i })).toBeVisible();
  await expect(page.getByText("Turborepo + pnpm template")).toBeVisible();
});
