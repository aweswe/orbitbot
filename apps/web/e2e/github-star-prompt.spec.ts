import { expect, test } from "@playwright/test";
import { activeBotId, completeOnboarding, rpc, signup } from "./helpers";

test("never asks for a GitHub star", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await signup(page, `star-prompt-${Date.now()}@orbit.test`, "password12", "Sample");
  await completeOnboarding(page);
  await rpc(page, "onboarding/dismissFocus", { botId: activeBotId(page) });
  // A stale upstream counter must not revive the closed-source product's prompt.
  await page.evaluate(() => localStorage.setItem("orbit.githubStarPrompt.sent", "5"));

  const composer = page.getByRole("combobox", { name: /Message/ });
  await composer.fill("What should I work on today?");
  await composer.press("Enter");
  await expect(page.getByTestId("message-user-bubble")).toContainText(
    "What should I work on today?",
  );
  await expect(page.getByRole("complementary", { name: "Star on GitHub" })).toHaveCount(0);

  await page.reload();
  await composer.fill("And tomorrow?");
  await composer.press("Enter");
  await expect(
    page.getByTestId("transcript").getByText("And tomorrow?", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("complementary", { name: "Star on GitHub" })).toHaveCount(0);
});
