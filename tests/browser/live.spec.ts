import { test, expect } from "@playwright/test";
test("owned public request shows source outcome and genuine provider quotes", async ({
  page,
}) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/requests/1");
  await expect(page.getByText("Last read", { exact: false })).toBeVisible({
    timeout: 60000,
  });
  await expect(
    page.getByText(/Debt repaid|Settlement confirmed/).first(),
  ).toBeVisible({ timeout: 60000 });
  await expect(
    page
      .getByText("0x30f50d7222e544FF5849987Fd33bd9A7569C7CCe", { exact: false })
      .first(),
  ).toBeVisible();
  expect(errors).toEqual([]);
  await page.screenshot({
    path: "docs/evidence/browser/live-request.png",
    fullPage: true,
  });
});
