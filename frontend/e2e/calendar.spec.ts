import { test, expect } from "@playwright/test";
import { mockApiRoutes } from "./fixtures/mock-router";

const PAGE_LOAD_TIMEOUT = 30000;

test.describe("Calendar Page", () => {
  test.beforeEach(async ({ page }) => {
    await mockApiRoutes(page);
    await page.goto("/calendar");
    await expect(page.locator('[data-testid="current-month"]')).toBeVisible();
  });

  test("should display page title", async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Calendar' })).toBeVisible();
  });

  test("should not raise javascript errors on page load", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error" || msg.type() === "warning") errors.push(msg.text());
    });
    page.on("pageerror", (err) => errors.push(err.message));
    await page.waitForTimeout(500);
    expect(errors).toHaveLength(0);
  });

  test("should display month navigation", async ({ page }) => {
    await expect(page.locator('[data-testid="month-nav-prev"]')).toBeVisible();
    await expect(page.locator('[data-testid="month-nav-next"]')).toBeVisible();
    await expect(page.locator('[data-testid="current-month"]')).toContainText(/\d{4}/);
  });

  test("should display calendar grid", async ({ page }) => {
    await expect(page.locator("text=Mon").first()).toBeVisible();
    await expect(page.locator("text=Tue").first()).toBeVisible();
    await expect(page.locator("text=Wed").first()).toBeVisible();
    await expect(page.locator("text=Fri").first()).toBeVisible();
    await expect(page.locator('[data-testid="calendar-grid"]')).toBeVisible();
  });

test("should display calendar events on days", async ({ page }) => {
    // Mock events are for 2024-03-15, so navigate to March 2024
    const monthDisplay = page.locator('[data-testid="current-month"]');
    for (let i = 0; i < 30; i++) {
      const monthText = await monthDisplay.textContent();
      if (monthText?.includes("March 2024")) break;
      await page.locator('[data-testid="month-nav-prev"]').click();
      await expect(monthDisplay).not.toHaveText(monthText!, { timeout: 3000 });
    }
    // Verify events show on the day cells (look for individual event pills, not containers which may be empty)
    await expect(page.locator('[data-testid^="calendar-event-"]').first()).toBeVisible();
  });

  test("should navigate to day view on day click", async ({ page }) => {
    const dayCell = page.locator('[data-testid^="calendar-day-"]').first();
    await dayCell.click();
    await expect(page).toHaveURL(/\/calendar\/\d{4}-\d{2}-\d{2}/);
  });

  test("should have attendee filter", async ({ page }) => {
    await expect(page.locator('input[placeholder="Filter by attendee..."]')).toBeVisible();
  });

  test("should navigate between months", async ({ page }) => {
    const initialMonth = await page.locator('[data-testid="current-month"]').textContent();

    await page.locator('[data-testid="month-nav-next"]').click();
    await expect(page.locator('[data-testid="current-month"]')).not.toHaveText(initialMonth!);

    await page.locator('[data-testid="month-nav-prev"]').click();
    await expect(page.locator('[data-testid="current-month"]')).toHaveText(initialMonth!);
  });
});

test.describe("Calendar Day Page", () => {
  test.beforeEach(async ({ page }) => {
    await mockApiRoutes(page);
    await page.goto("/calendar/2024-03-15");
    await expect(page.locator('[data-testid="date-title"]')).toBeVisible({ timeout: PAGE_LOAD_TIMEOUT });
  });

  test("should display date title", async ({ page }) => {
    await expect(page.locator('[data-testid="date-title"]')).toContainText(/March|Friday/);
  });

  test("should have back button to calendar", async ({ page }) => {
    await expect(page.locator('[data-testid="back-to-calendar"]')).toBeVisible();
    await page.locator('[data-testid="back-to-calendar"]').click();
    await expect(page).toHaveURL(/\/calendar/);
  });

  test("should display events section", async ({ page }) => {
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