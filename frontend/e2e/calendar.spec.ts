import { test, expect } from "@playwright/test";
import { setupTest, setupTestSimple } from "./fixtures/test-helpers";

// Global timeout for waiting for page to load
const PAGE_LOAD_TIMEOUT = 20000;

test.describe("Calendar Page", () => {
  test.beforeEach(async ({ page }) => {
    await setupTestSimple(page, "/calendar", { debug: true });
  });

  test("should display page title", async ({ page }) => {
    const mainContent = page.locator("main");
    await expect(mainContent.getByRole('heading', { name: 'Calendar' })).toBeVisible();
  });

  test("should display month navigation", async ({ page }) => {
    await expect(page.locator('[data-testid="month-nav-prev"]')).toBeVisible();
    await expect(page.locator('[data-testid="month-nav-next"]')).toBeVisible();
    // Month/Year display in calendar header - just check for year pattern
    await expect(page.locator('[data-testid="current-month"]')).toContainText(/\d{4}/);
  });

  test("should display calendar grid", async ({ page }) => {
    // Check for weekday headers (could be abbreviated)
    await expect(page.locator("text=/Mon|M/").first()).toBeVisible();
    await expect(page.locator("text=/Tue|T/").first()).toBeVisible();
    await expect(page.locator("text=/Wed|W/").first()).toBeVisible();
    await expect(page.locator("text=/Thu|Th/").first()).toBeVisible();
    await expect(page.locator("text=/Fri|F/").first()).toBeVisible();
    await expect(page.locator("text=/Sat|Sa/").first()).toBeVisible();
    await expect(page.locator("text=/Sun|Su/").first()).toBeVisible();
  });

  test("should display calendar events on days", async ({ page }) => {
    // Navigate directly to March 2024 where mock events exist
    // Note: Calendar component loads from current date, so we need to navigate to March 2024
    await page.goto("/calendar");
    await page.waitForLoadState("networkidle");

    // Navigate to March 2024 by clicking prev month until we get there
    // Current date is ~2026, so we need to go back about 24 months
    for (let i = 0; i < 30; i++) {
      const monthText = await page.locator('[data-testid="current-month"]').textContent();
      if (monthText?.includes("March 2024")) break;
      await page.locator('[data-testid="month-nav-prev"]').click();
      await page.waitForTimeout(50);
    }

    // Events should be visible on calendar days - check by text content
    await expect(page.locator('text=1:1 with Alice')).toBeVisible();
  });

  test("should navigate to day view on day click", async ({ page }) => {
    // Find a day cell with the 15th and click it
    await page.locator('div:has-text("15")').filter({ hasText: /^15$/ }).first().click();
    // Should navigate to a date URL
    await expect(page).toHaveURL(/\/calendar\/\d{4}-\d{2}-\d{2}/);
  });

  test("should have attendee filter", async ({ page }) => {
    await expect(page.locator('input[placeholder="Filter by attendee..."]')).toBeVisible();
  });

  test("should navigate between months", async ({ page }) => {
    // Get initial month text
    const initialMonth = await page.locator('[data-testid="current-month"]').textContent();

    // Click next month
    await page.locator('[data-testid="month-nav-next"]').click();
    // Wait for month to change
    await page.waitForTimeout(100);
    const nextMonth = await page.locator('[data-testid="current-month"]').textContent();
    expect(nextMonth).not.toEqual(initialMonth);

    // Click previous month
    await page.locator('[data-testid="month-nav-prev"]').click();
    await page.waitForTimeout(100);
    const prevMonth = await page.locator('[data-testid="current-month"]').textContent();
    expect(prevMonth).toEqual(initialMonth);
  });
});

test.describe("Calendar Day Page", () => {
  test.beforeEach(async ({ page }) => {
    await setupTestSimple(page, "/calendar/2024-03-15", { debug: true });
  });

  test("should display date title", async ({ page }) => {
    // Wait for loading to finish
    await page.waitForFunction(() => {
      const loadingEl = document.querySelector('p');
      return !loadingEl || loadingEl.textContent !== 'Loading...';
    }, { timeout: PAGE_LOAD_TIMEOUT });
    
    // Match the formatted date shown in the UI
    const heading = page.getByRole('heading').filter({ hasText: /March|Friday/ }).first();
    await expect(heading).toBeVisible();
  });

  test("should have back button to calendar", async ({ page }) => {
    await expect(page.locator("text=Back to Calendar")).toBeVisible();
    await page.locator("text=Back to Calendar").click();
    await page.waitForResponse("**/api/calendar**");
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveURL(/\/calendar$/);
  });

  test("should display events section", async ({ page }) => {
    // Wait for loading to finish
    await page.waitForFunction(() => {
      const loadingEl = document.querySelector('p');
      return !loadingEl || loadingEl.textContent !== 'Loading...';
    }, { timeout: PAGE_LOAD_TIMEOUT });
    
    // Look for events specifically in the events section
    const eventsSection = page.locator("section").filter({ has: page.locator("h2:has-text('Events')") }).first();
    await expect(eventsSection.locator("h2:has-text('Events')")).toBeVisible();
    await expect(eventsSection.locator("h3:has-text('1:1 with Alice')")).toBeVisible();
    await expect(eventsSection.locator("text=Conference Room A")).toBeVisible();
  });

  test("should display notes section", async ({ page }) => {
    // Wait for loading to finish
    await page.waitForFunction(() => {
      const loadingEl = document.querySelector('p');
      return !loadingEl || loadingEl.textContent !== 'Loading...';
    }, { timeout: PAGE_LOAD_TIMEOUT });
    
    const notesSection = page.locator("section").filter({ has: page.locator("h2:has-text('Notes')") }).first();
    await expect(notesSection.locator("h2:has-text('Notes')")).toBeVisible();
    await expect(notesSection.locator("h3:has-text('1:1 with Alice - March 2024')")).toBeVisible();
  });

  test("should navigate to note from day view", async ({ page }) => {
    // Wait for loading to finish
    await page.waitForFunction(() => {
      const loadingEl = document.querySelector('p');
      return !loadingEl || loadingEl.textContent !== 'Loading...';
    }, { timeout: PAGE_LOAD_TIMEOUT });
    
    await page.locator("h3:has-text('1:1 with Alice - March 2024')").click();
    await expect(page).toHaveURL(/\/notes\/note-001/);
  });
});
