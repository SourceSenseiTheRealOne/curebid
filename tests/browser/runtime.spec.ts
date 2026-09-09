import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("desktop WebGL, pause and themes render without errors", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto("/");
  await expect(page.locator("canvas")).toBeVisible();
  await page.getByRole("button", { name: "Pause motion" }).click();
  await expect(page.getByTestId("mechanism")).toHaveAttribute(
    "data-motion",
    "still",
  );
  await page.screenshot({
    path: "docs/evidence/browser/desktop-light.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Toggle color theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator("canvas")).toBeVisible();
  await page.getByRole("button", { name: "Pause motion" }).click();
  await page.screenshot({
    path: "docs/evidence/browser/desktop-dark.png",
    fullPage: true,
  });
  const axe = await new AxeBuilder({ page }).analyze();
  expect(
    axe.violations.filter((v) =>
      ["serious", "critical"].includes(v.impact ?? ""),
    ),
  ).toEqual([]);
  expect(errors).toEqual([]);
});
test("320px routes and WebGL fallback retain controls", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      ...args: Parameters<typeof original>
    ) {
      if (String(args[0]).includes("webgl")) return null;
      return original.apply(this, args);
    } as typeof original;
  });
  for (const route of ["/", "/repay", "/providers", "/verify"]) {
    await page.goto(route);
    await expect(page.locator("h1")).toBeVisible();
    expect(
      await page.evaluate(() => ({
        width: innerWidth,
        overflow: document.documentElement.scrollWidth > innerWidth,
      })),
    ).toEqual({ width: 320, overflow: false });
    if (route === "/")
      await expect(page.locator(".static-mechanism")).toBeVisible();
  }
  await page.goto("/repay");
  await expect(
    page.getByRole("button", { name: "Fund request" }),
  ).toBeDisabled();
  await page.screenshot({
    path: "docs/evidence/browser/mobile-fallback.png",
    fullPage: true,
  });
});
test("proof endpoint rejects malformed input without signing", async ({
  request,
}) => {
  const r = await request.post("/api/proof", { data: { hash: "not-a-hash" } });
  expect(r.status()).toBe(400);
  expect((await r.json()).proof).toBeUndefined();
});
