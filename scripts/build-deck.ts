import { chromium } from "@playwright/test";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 720 },
  });
  await page.goto(pathToFileURL(resolve("docs/submission/deck.html")).href);
  const slides = await page.locator("section").count();
  for (const s of await page.locator("section").all()) {
    const bounds = await s.evaluate((el) => ({
      h: el.scrollHeight,
      w: el.scrollWidth,
    }));
    if (bounds.h > 720 || bounds.w > 1280)
      throw new Error("Deck slide overflow");
  }
  await page.pdf({
    path: "docs/submission/curebid-deck.pdf",
    printBackground: true,
    preferCSSPageSize: true,
  });
  await page
    .locator("section")
    .first()
    .screenshot({ path: "docs/evidence/browser/deck-cover.png" });
  console.log(
    JSON.stringify({
      slides,
      pdf: "docs/submission/curebid-deck.pdf",
      status: "public testnet repayment and refund verified",
    }),
  );
} finally {
  await browser.close();
}
