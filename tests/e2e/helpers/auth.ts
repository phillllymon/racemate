import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

export async function login(page: Page) {
  const email = process.env.TEST_EMAIL;
  const password = process.env.TEST_PASSWORD;
  if (!email || !password) {
    throw new Error("TEST_EMAIL and TEST_PASSWORD environment variables must be set");
  }

  await page.goto("/");
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: "Sign In" }).click();

  // Wait until the tab bar is visible — confirms successful login
  await expect(page.getByRole("button", { name: "Series" })).toBeVisible({ timeout: 10_000 });
}
