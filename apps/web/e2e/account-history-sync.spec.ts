import { expect, test } from "@playwright/test";
import { activeBotId, completeOnboarding, rpc, signup } from "./helpers";

test("the same account restores its bots and history on another device", async ({
  browser,
}, testInfo) => {
  const stamp = Date.now();
  const email = `device-sync-${stamp}@orbit.test`;
  const password = "password12";
  const baseURL = testInfo.project.use.baseURL;
  if (!baseURL) throw new Error("device sync needs a baseURL");

  const first = await browser.newContext({ baseURL });
  const firstPage = await first.newPage();
  await signup(firstPage, email, password, "Device One");
  await completeOnboarding(firstPage);
  const bot = await rpc<{ id: string }>(firstPage, "bots/create", {
    name: "Sync Buddy",
    description: "",
    instructions: "",
    notifyOnFinish: true,
    computerMode: "team",
  });
  const text = `kept for every device ${stamp}`;
  await rpc(firstPage, "threads/send", { botId: bot.id, text });
  await firstPage.goto(`/app/${bot.id}`);
  await expect(firstPage.getByTestId("transcript").getByText(text, { exact: true })).toBeVisible({
    timeout: 20_000,
  });

  // A separate browser context is a separate device: no cookies, storage, or cache.
  const second = await browser.newContext({ baseURL });
  const secondPage = await second.newPage();
  await secondPage.goto("/sign-in");
  await secondPage.getByLabel("Email", { exact: true }).fill(email);
  await secondPage.getByLabel("Password", { exact: true }).fill(password);
  await secondPage.getByRole("button", { name: "Sign in", exact: true }).click();
  await secondPage.waitForURL(/\/app\//, { timeout: 20_000 });

  const sidebar = secondPage.locator("aside").first();
  await expect(sidebar.getByRole("button", { name: /^Sync Buddy/ })).toBeVisible({
    timeout: 20_000,
  });
  await secondPage.goto(`/app/${bot.id}`);
  await expect(secondPage.getByTestId("transcript").getByText(text, { exact: true })).toBeVisible({
    timeout: 20_000,
  });
  expect(activeBotId(secondPage)).toBe(bot.id);

  await first.close();
  await second.close();
});
