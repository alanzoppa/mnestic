import { test, expect } from "@playwright/test";
import { mockApiRoutes } from "./fixtures/mock-router";

test.describe("Calendar Page", () => {
  test.beforeEach(async ({ page }) => {
    await mockApiRoutes(page);
    await page.goto("/calendar");
  });

  test("should display page title", async ({ page }) => {
    const mainContent = page.locator("main");
    await expect(mainContent.getByRole('heading', { name: 'Calendar' })).toBeVisible();
  });

  test("should display month navigation", async ({ page }) => {
    await expect(page.locator('button:has-text("←")')).toBeVisible();
    await expect(page.locator('button:has-text("→")')).toBeVisible();
    // Month/Year display in calendar header
    await expect(page.locator("span:has-text('2024')")).toBeVisible();
  });

  test("should display calendar grid", async ({ page }) => {
    await expect(page.locator("text=Mon")).toBeVisible();
    await expect(page.locator("text=Tue")).toBeVisible();
    await expect(page.locator("text=Wed")).toBeVisible();
    await expect(page.locator("text=Thu")).toBeVisible();
    await expect(page.locator("text=Fri")).toBeVisible();
    await expect(page.locator("text=Sat")).toBeVisible();
    await expect(page.locator("text=Sun")).toBeVisible();
  });

  test("should display calendar events on days", async ({ page }) => {
    await expect(page.locator("div:has-text('1:1 with Alice')").first()).toBeVisible();
  });

  test("should navigate to day view on day click", async ({ page }) => {
    await page.locator('div:has-text("15")').nth(1).click();
    await expect(page).toHaveURL(/\/calendar\/2024-03-15/);
  });

  test("should have attendee filter", async ({ page }) => {
    await expect(page.locator('input[placeholder="Filter by attendee..."]')).toBeVisible();
  });

  test("should navigate between months", async ({ page }) => {
    await page.locator('button:has-text("→")').click();
    // Allow for timezone/locale variations in month display
    const currentMonthText = await page.locator('span.text-lg').textContent();
    expect(currentMonthText).toContain('2024');

    await page.locator('button:has-text("←")').click();
    await expect(page.locator("span:has-text('2024')")).toBeVisible();
  });
});

test.describe("Calendar Day Page", () => {
  test.beforeEach(async ({ page }) => {
    await mockApiRoutes(page);
    await page.goto("/calendar/2024-03-15");
  });

  test("should display date title", async ({ page }) => {
    // Match the formatted date shown in the UI
    const heading = page.getByRole('heading').filter({ hasText: /March|Friday/ }).first();
    await expect(heading).toBeVisible();
  });

  test("should have back button to calendar", async ({ page }) => {
    await expect(page.locator("text=Back to Calendar")).toBeVisible();
    await page.locator("text=Back to Calendar").click();
    await expect(page).toHaveURL(/\/calendar$/);
  });

  test("should display events section", async ({ page }) => {
    // Look for events specifically in the events section
    const eventsSection = page.locator("section").filter({ has: page.locator("h2:has-text('Events')") }).first();
    await expect(eventsSection.locator("h2:has-text('Events')")).toBeVisible();
    await expect(eventsSection.locator("h3:has-text('1:1 with Alice')")).toBeVisible();
    await expect(eventsSection.locator("text=Conference Room A")).toBeVisible();
  });

  test("should display notes section", async ({ page }) => {
    const notesSection = page.locator("section").filter({ has: page.locator("h2:has-text('Notes')") }).first();
    await expect(notesSection.locator("h2:has-text('Notes')")).toBeVisible();
    await expect(notesSection.locator("h3:has-text('1:1 with Alice - March 2024')")).toBeVisible();
  });

  test("should navigate to note from day view", async ({ page }) => {
    await page.locator("h3:has-text('1:1 with Alice - March 2024')").click();
    await expect(page).toHaveURL(/\/notes\/note-001/);
  });
});
