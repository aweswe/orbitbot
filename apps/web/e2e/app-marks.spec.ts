import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { completeOnboarding, signup } from "./helpers";

// Cached public catalog artwork keeps visual coverage offline and repeatable.
const apps = ["gmail", "notion", "github"];
const catalogApps = ["gmail", "obscure-app", "notion", "github"];
test.use({ deviceScaleFactor: 3 });

for (const theme of ["light", "dark"]) {
  test(`familiar app suggestions share a plate and separating ring in ${theme}`, async ({
    page,
  }, testInfo) => {
    await page.addInitScript((theme) => localStorage.setItem("orbit.uiAppearance", theme), theme);
    for (const app of catalogApps) {
      await page.route(`https://logos.composio.dev/api/${app}`, (route) =>
        route.fulfill({
          contentType: "image/svg+xml",
          body: readFileSync(
            new URL(
              `./fixtures/app-marks/${app === "obscure-app" ? "notion" : app}.svg`,
              import.meta.url,
            ),
          ),
        }),
      );
    }
    await page.route("**/rpc/connections/catalog", (route) =>
      route.fulfill({
        json: {
          json: catalogApps.map((slug) => ({
            connectorId: "composio",
            slug,
            name: slug,
            connected: false,
            noAuth: false,
            logo: `https://logos.composio.dev/api/${slug}`,
          })),
        },
      }),
    );
    await signup(page, `app-marks-${theme}-${Date.now()}@orbit.test`, "password12", "Demo User");
    await completeOnboarding(page);
    const header = page.getByTestId("orbit-command-bar");
    const button = header.getByRole("button", { name: "Connected apps", exact: true });
    const tiles = button.locator('span[aria-hidden="true"] > span');
    await expect(tiles).toHaveCount(3);
    const images = tiles.locator("img");
    await expect(images).toHaveCount(apps.length);
    for (const index of apps.keys()) {
      await expect(images.nth(index)).toHaveAttribute(
        "src",
        `https://logos.composio.dev/api/${apps[index]}`,
      );
      await expect
        .poll(() => images.nth(index).evaluate((el) => (el as HTMLImageElement).naturalWidth))
        .toBeGreaterThan(0);
    }
    for (const hover of [false, true]) {
      if (hover) await button.hover();
      else await page.mouse.move(1000, 400);
      // Button colors transition after pointer/theme changes; let the hover settle.
      await page.waitForTimeout(150);
      const boxes = await tiles.evaluateAll((els) =>
        els.map((el) => {
          const style = getComputedStyle(el);
          const box = el.getBoundingClientRect();
          return {
            x: box.x,
            y: box.y,
            width: box.width,
            height: box.height,
            background: style.backgroundColor,
            shadow: style.boxShadow,
            padding: style.padding,
            zIndex: style.zIndex,
          };
        }),
      );
      for (const [index, box] of boxes.entries()) {
        expect(box).toMatchObject({
          width: 18,
          height: 18,
          background: "rgb(255, 255, 255)",
          padding: "3px",
          zIndex: String(index),
        });
        expect(box.shadow).not.toBe("none");
        expect(box.y).toBe(boxes[0]!.y);
        if (index) expect(box.x - boxes[index - 1]!.x).toBeCloseTo(16.5, 1);
      }
      const path = testInfo.outputPath(`app-marks-${theme}${hover ? "-hover" : ""}.png`);
      await header.screenshot({ path, animations: "disabled" });
      await testInfo.attach(`app-marks-${theme}${hover ? "-hover" : ""}`, {
        path,
        contentType: "image/png",
      });
    }
  });
}
