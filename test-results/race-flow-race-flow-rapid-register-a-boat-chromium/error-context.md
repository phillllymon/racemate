# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: race-flow.spec.ts >> race flow >> rapid register a boat
- Location: tests/e2e/race-flow.spec.ts:84:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('.rapid-boat-item-name').filter({ hasText: 'Test Boat' })
Expected: visible
Timeout: 15000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 15000ms
  - waiting for locator('.rapid-boat-item-name').filter({ hasText: 'Test Boat' })

```

```yaml
- text: racemate
- paragraph: Race Committee Console
- button "Menu":
  - img
- button "14:28:58":
  - text: 14:28:58
  - img
- text: ⏱ Test Race mqpq9iuu
- img
- button "Enter fullscreen":
  - img
- button "← Back"
- text: Rapid Register 0 registered
- button "Submit" [disabled]
- textbox "Boat name *"
- textbox "Sail number / note"
- button "←" [disabled]
- button "1"
- button "2"
- button "3"
- button "4"
- button "5"
- button "6"
- button "7"
- button "8"
- button "9"
- button "0"
- button "Registered (0)":
  - text: Registered (0)
  - img
- textbox "Search boats..."
- button "Voice search":
  - img
- paragraph: No boats registered yet
- button "Series"
- button "Check-In"
- button "Start"
- button "Chart"
- button "Finish"
- button "Results"
```

# Test source

```ts
  16  |     await login(sharedPage);
  17  |   });
  18  | 
  19  |   test.afterAll(async () => {
  20  |     try {
  21  |       const page = sharedPage;
  22  |       await page.getByRole("button", { name: "Series" }).click();
  23  | 
  24  |       // Expand the series if collapsed (click its name span inside the header toggle)
  25  |       const seriesName = page.locator(".series-card-name").filter({ hasText: SERIES_NAME });
  26  |       await seriesName.waitFor({ timeout: 5_000 });
  27  |       const seriesCard = page.locator(".series-card").filter({ hasText: SERIES_NAME });
  28  |       const seriesBody = seriesCard.locator(".series-card-body");
  29  |       if (!(await seriesBody.isVisible())) {
  30  |         await seriesName.click();
  31  |       }
  32  | 
  33  |       // Click the pencil edit button (only visible when expanded)
  34  |       await seriesCard.getByRole("button", { name: "Edit series" }).click();
  35  |       await page.getByRole("button", { name: "Delete series and all races" }).click();
  36  |       await page.getByRole("button", { name: "Delete" }).click();
  37  |     } catch {
  38  |       console.warn(`Could not clean up test series "${SERIES_NAME}"`);
  39  |     }
  40  | 
  41  |     await sharedPage.close();
  42  |   });
  43  | 
  44  |   test("create a series and race", async () => {
  45  |     const page = sharedPage;
  46  | 
  47  |     // ---- Create series ----
  48  |     await page.getByRole("button", { name: "New Series" }).click();
  49  |     await page.getByPlaceholder("Series name").fill(SERIES_NAME);
  50  |     await page.getByRole("button", { name: "Create Series" }).click();
  51  | 
  52  |     // Series card appears but collapsed — click its name span to expand
  53  |     const seriesCard = page.locator(".series-card").filter({ hasText: SERIES_NAME });
  54  |     await expect(seriesCard).toBeVisible();
  55  |     await page.locator(".series-card-name").filter({ hasText: SERIES_NAME }).click();
  56  | 
  57  |     // ---- Create race inside the series ----
  58  |     await page.getByRole("button", { name: "+ Add Race" }).click();
  59  |     await page.getByPlaceholder("Race name").fill(RACE_NAME);
  60  |     await page.getByRole("button", { name: "Create Race" }).click();
  61  | 
  62  |     // Wait for the race card to appear inside the series (scope avoids topbar/results ambiguity)
  63  |     const raceCardName = seriesCard.locator(".race-card-name").filter({ hasText: RACE_NAME });
  64  |     await expect(raceCardName).toBeVisible();
  65  | 
  66  |     // Expand the race card by clicking its name span
  67  |     await raceCardName.click();
  68  | 
  69  |     // Race may already be auto-selected after creation; only click "Select" if needed
  70  |     const selectBtn = page.getByRole("button", { name: "Select This Race" });
  71  |     if (await selectBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
  72  |       await selectBtn.click();
  73  |     }
  74  | 
  75  |     // ---- Add a class ----
  76  |     await page.getByRole("button", { name: "+ Add Class" }).click();
  77  |     await page.getByPlaceholder("Class name").fill(CLASS_NAME);
  78  |     await page.getByRole("button", { name: "Create Class" }).click();
  79  | 
  80  |     // Class name now appears in the race card body (exact to avoid matching "+ Add Boats to Spinnaker")
  81  |     await expect(seriesCard.getByText(CLASS_NAME, { exact: true })).toBeVisible();
  82  |   });
  83  | 
  84  |   test("rapid register a boat", async () => {
  85  |     const page = sharedPage;
  86  | 
  87  |     // Navigate to Check-In tab for the already-selected race
  88  |     await page.getByRole("button", { name: "Check-In" }).click();
  89  |     await expect(page.getByRole("button", { name: "Rapid Register" })).toBeVisible();
  90  |     await page.getByRole("button", { name: "Rapid Register" }).click();
  91  | 
  92  |     // Wait for the Spinnaker class button to appear (uses .rapid-class-btn to stay unambiguous)
  93  |     const spinnakerBtn = page.locator(".rapid-class-btn").filter({ hasText: CLASS_NAME });
  94  |     await expect(spinnakerBtn).toBeVisible();
  95  |     await spinnakerBtn.click();
  96  |     await expect(spinnakerBtn).toHaveClass(/rapid-class-btn--active/);
  97  | 
  98  |     // Fill boat name and verify it took
  99  |     const boatNameInput = page.getByPlaceholder("Boat name *");
  100 |     await boatNameInput.click();
  101 |     await boatNameInput.fill("Test Boat");
  102 |     await expect(boatNameInput).toHaveValue("Test Boat");
  103 | 
  104 |     // Enter sail number via numpad and verify
  105 |     await page.getByRole("button", { name: "4", exact: true }).click();
  106 |     await page.getByRole("button", { name: "2", exact: true }).click();
  107 |     await expect(page.getByPlaceholder("Sail number / note")).toHaveValue("42");
  108 | 
  109 |     // Submit
  110 |     const submitBtn = page.getByRole("button", { name: "Submit" });
  111 |     await expect(submitBtn).toBeEnabled();
  112 |     await submitBtn.click();
  113 | 
  114 |     // Boat should appear in the registered list
  115 |     await expect(page.locator(".rapid-boat-item-name").filter({ hasText: "Test Boat" }))
> 116 |       .toBeVisible({ timeout: 15_000 });
      |        ^ Error: expect(locator).toBeVisible() failed
  117 |   });
  118 | 
  119 |   test("check in a boat", async () => {
  120 |     const page = sharedPage;
  121 | 
  122 |     // Exit rapid register mode if still in it
  123 |     const backBtn = page.getByRole("button", { name: "← Back" });
  124 |     if (await backBtn.isVisible()) await backBtn.click();
  125 | 
  126 |     // Rapid register creates boats with "checked-in" status, so the boat should already
  127 |     // show as checked-in in the normal view. If for some reason it's only "registered",
  128 |     // click "Check In" first.
  129 |     const alreadyCheckedIn = page.locator(".finish-search-item--finished").first();
  130 |     const isAlreadyCheckedIn = await alreadyCheckedIn.isVisible({ timeout: 3_000 }).catch(() => false);
  131 |     if (!isAlreadyCheckedIn) {
  132 |       const checkInBtn = page.getByRole("button", { name: "Check In" }).first();
  133 |       await expect(checkInBtn).toBeVisible({ timeout: 5_000 });
  134 |       await checkInBtn.click();
  135 |     }
  136 | 
  137 |     // Checkmark should be visible
  138 |     await expect(page.locator(".finish-search-item--finished").first()).toBeVisible({ timeout: 5_000 });
  139 |   });
  140 | });
  141 | 
```