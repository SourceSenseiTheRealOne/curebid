import { chromium } from "@playwright/test";
import { mkdir, rename } from "node:fs/promises";
await mkdir("docs/submission", { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  recordVideo: {
    dir: ".local/demo-capture",
    size: { width: 1440, height: 900 },
  },
  colorScheme: "dark",
});
const page = await context.newPage();
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  async function scene(path: string, caption: string) {
    await page.goto("http://127.0.0.1:4310" + path);
    await page.locator("h1").waitFor();
    await page.evaluate((text) => {
      const el = document.createElement("div");
      el.textContent = text;
      el.style.cssText =
        "position:fixed;bottom:16px;left:24px;right:24px;padding:16px 20px;background:#182b20;color:#f2fff7;border:1px solid #85d8ae;border-radius:8px;font:16px Arial,sans-serif;z-index:99";
      document.body.appendChild(el);
    }, caption);
  }
  await scene(
    "/",
    "CureBid: local UI connected to public testnets. Recorded walkthrough, not live signing.",
  );
  await page.waitForTimeout(7000);
  await scene(
    "/requests/1",
    "Two real CTC quotes: 0.07 and 0.09. The borrower selected Provider A.",
  );
  await page
    .getByText("Settlement confirmed", { exact: true })
    .waitFor({ timeout: 60000 });
  await page.getByText("Binding quote history (2)", { exact: true }).click();
  await page
    .getByText("Binding quote history (2)", { exact: true })
    .scrollIntoViewIfNeeded();
  await page.waitForTimeout(9000);
  await page.locator(".amount-pair").scrollIntoViewIfNeeded();
  await page.waitForTimeout(6000);
  await scene(
    "/requests/2",
    "Separate non-execution case: source expiry proof authorizes the borrower refund.",
  );
  await page
    .getByText("Refund confirmed", { exact: true })
    .waitFor({ timeout: 60000 });
  await page.locator(".request-title").scrollIntoViewIfNeeded();
  await page.waitForTimeout(9000);
  await scene(
    "/verify",
    "Inspect real source and Creditcoin transaction receipts. No fabricated settlement flags.",
  );
  await page
    .getByRole("heading", { name: "Recorded public execution" })
    .scrollIntoViewIfNeeded();
  await page
    .getByRole("link", { name: /Source receipt:/ })
    .first()
    .waitFor();
  await page.waitForTimeout(9000);
  if (errors.length) throw new Error(errors.join("; "));
  const video = page.video()!;
  await page.close();
  await context.close();
  await rename(await video.path(), "docs/submission/curebid-walkthrough.webm");
  console.log(
    "Recorded verified public-testnet UI walkthrough: docs/submission/curebid-walkthrough.webm",
  );
} finally {
  await browser.close();
}
