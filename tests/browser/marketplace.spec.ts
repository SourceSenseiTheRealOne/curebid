import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
// Isolated empty-state fixture; production keeps the real deployment manifest.
test.beforeEach(async ({ page }) => {
  await page.route("**/deployment.json", (route) =>
    route.fulfill({ json: null }),
  );
});
test("marketplace exposes real empty and no-wallet states", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Your debt. Their liquidity." }),
  ).toBeVisible();
  await expect(
    page.getByText("No deployment configured", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Connect wallet", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByText("No browser wallet detected", { exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
});
test("mobile layout and reduced motion remain usable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.getByTestId("mechanism")).toHaveAttribute(
    "data-motion",
    "still",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    ),
  ).toBe(0);
  await expect(
    page.getByRole("link", { name: "Create request", exact: true }),
  ).toBeVisible();
});
test("new request validates units and blocks undeployed writes", async ({
  page,
}) => {
  await page.goto("/requests/new");
  await expect(page.getByLabel("Repayment amount (USDC)")).toBeVisible();
  await page.getByLabel("Repayment amount (USDC)").fill("300.0000001");
  await expect(
    page.getByText("Too many decimal places", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Fund request", exact: true }),
  ).toBeDisabled();
});
test("marketplace has no serious accessibility violations", async ({
  page,
}) => {
  await page.goto("/");
  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations.filter((v) =>
      ["serious", "critical"].includes(v.impact ?? ""),
    ),
  ).toEqual([]);
});
