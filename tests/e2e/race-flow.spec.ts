import { test, expect, type Page } from "@playwright/test";
import { login } from "./helpers/auth";

const RUN_ID = Date.now().toString(36);
const SERIES_NAME = `Test Series ${RUN_ID}`;
const RACE_NAME = `Test Race ${RUN_ID}`;
const CLASS_NAME = `Spinnaker`;

// Shared page — test.describe.serial guarantees all tests run in the same worker
// so module-level state persists across tests.
let sharedPage: Page;

test.describe.serial("race flow", () => {
  test.beforeAll(async ({ browser }) => {
    sharedPage = await browser.newPage();
    await login(sharedPage);
  });

  test.afterAll(async () => {
    try {
      const page = sharedPage;
      await page.getByRole("button", { name: "Series" }).click();

      // Expand the series if collapsed (click its name span inside the header toggle)
      const seriesName = page.locator(".series-card-name").filter({ hasText: SERIES_NAME });
      await seriesName.waitFor({ timeout: 5_000 });
      const seriesCard = page.locator(".series-card").filter({ hasText: SERIES_NAME });
      const seriesBody = seriesCard.locator(".series-card-body");
      if (!(await seriesBody.isVisible())) {
        await seriesName.click();
      }

      // Click the pencil edit button (only visible when expanded)
      await seriesCard.getByRole("button", { name: "Edit series" }).click();
      await page.getByRole("button", { name: "Delete series and all races" }).click();
      await page.getByRole("button", { name: "Delete" }).click();
    } catch {
      console.warn(`Could not clean up test series "${SERIES_NAME}"`);
    }

    await sharedPage.close();
  });

  test("create a series and race", async () => {
    const page = sharedPage;

    // ---- Create series ----
    await page.getByRole("button", { name: "New Series" }).click();
    await page.getByPlaceholder("Series name").fill(SERIES_NAME);
    await page.getByRole("button", { name: "Create Series" }).click();

    // Series card appears but collapsed — click its name span to expand
    const seriesCard = page.locator(".series-card").filter({ hasText: SERIES_NAME });
    await expect(seriesCard).toBeVisible();
    await page.locator(".series-card-name").filter({ hasText: SERIES_NAME }).click();

    // ---- Create race inside the series ----
    await page.getByRole("button", { name: "+ Add Race" }).click();
    await page.getByPlaceholder("Race name").fill(RACE_NAME);

    // Wait for the server to confirm the race so we get the real ID before adding a class.
    // If we add a class while the temp ID is still active the pending-write queue gets keyed
    // to the temp ID and the 15-second poll will overwrite emptyClasses with the server copy.
    const addRaceResponse = page.waitForResponse(
      (r) => r.url().includes("/api/addRace") && r.request().method() === "POST",
      { timeout: 15_000 }
    );
    await page.getByRole("button", { name: "Create Race" }).click();
    await addRaceResponse;

    // Wait for the race card to appear inside the series (scope avoids topbar/results ambiguity)
    const raceCardName = seriesCard.locator(".race-card-name").filter({ hasText: RACE_NAME });
    await expect(raceCardName).toBeVisible();

    // Expand the race card by clicking its name span
    await raceCardName.click();

    // Race may already be auto-selected after creation; only click "Select" if needed
    const selectBtn = page.getByRole("button", { name: "Select This Race" });
    if (await selectBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await selectBtn.click();
    }

    // ---- Add a class ----
    await page.getByRole("button", { name: "+ Add Class" }).click();
    await page.getByPlaceholder("Class name").fill(CLASS_NAME);
    await page.getByRole("button", { name: "Create Class" }).click();

    // Class name now appears in the race card body (exact to avoid matching "+ Add Boats to Spinnaker")
    await expect(seriesCard.getByText(CLASS_NAME, { exact: true })).toBeVisible();
  });

  test("rapid register a boat", async () => {
    const page = sharedPage;

    // Navigate to Check-In tab for the already-selected race
    await page.getByRole("button", { name: "Check-In" }).click();
    await expect(page.getByRole("button", { name: "Rapid Register" })).toBeVisible();
    await page.getByRole("button", { name: "Rapid Register" }).click();

    // Wait for the Spinnaker class button to appear (uses .rapid-class-btn to stay unambiguous)
    const spinnakerBtn = page.locator(".rapid-class-btn").filter({ hasText: CLASS_NAME });
    await expect(spinnakerBtn).toBeVisible();
    await spinnakerBtn.click();
    await expect(spinnakerBtn).toHaveClass(/rapid-class-btn--active/);

    // Fill boat name and verify it took
    const boatNameInput = page.getByPlaceholder("Boat name *");
    await boatNameInput.click();
    await boatNameInput.fill("Test Boat");
    await expect(boatNameInput).toHaveValue("Test Boat");

    // Enter sail number via numpad and verify
    await page.getByRole("button", { name: "4", exact: true }).click();
    await page.getByRole("button", { name: "2", exact: true }).click();
    await expect(page.getByPlaceholder("Sail number / note")).toHaveValue("42");

    // Submit
    const submitBtn = page.getByRole("button", { name: "Submit" });
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    // Boat should appear in the registered list
    await expect(page.locator(".rapid-boat-item-name").filter({ hasText: "Test Boat" }))
      .toBeVisible({ timeout: 15_000 });
  });

  test("check in a boat", async () => {
    const page = sharedPage;

    // Exit rapid register mode if still in it
    const backBtn = page.getByRole("button", { name: "← Back" });
    if (await backBtn.isVisible()) await backBtn.click();

    // Rapid register creates boats with "checked-in" status, so the boat should already
    // show as checked-in in the normal view. If for some reason it's only "registered",
    // click "Check In" first.
    const alreadyCheckedIn = page.locator(".finish-search-item--finished").first();
    const isAlreadyCheckedIn = await alreadyCheckedIn.isVisible({ timeout: 3_000 }).catch(() => false);
    if (!isAlreadyCheckedIn) {
      const checkInBtn = page.getByRole("button", { name: "Check In" }).first();
      await expect(checkInBtn).toBeVisible({ timeout: 5_000 });
      await checkInBtn.click();
    }

    // Checkmark should be visible
    await expect(page.locator(".finish-search-item--finished").first()).toBeVisible({ timeout: 5_000 });
  });
});
