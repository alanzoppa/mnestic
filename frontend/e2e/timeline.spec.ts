import { test, expect } from "@playwright/test";
import { mockApiRoutes } from "./fixtures/mock-router";

test.describe("Timeline Page", () => {
  test.beforeEach(async ({ page }) => {
    await mockApiRoutes(page);
    await page.goto("/timeline");
  });

  test("should display page title", async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Timeline' })).toBeVisible();
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

  test("should display chart", async ({ page }) => {
    await expect(page.locator(".recharts-wrapper")).toBeVisible();
  });

  test("should have tag filter dropdown", async ({ page }) => {
    // Timeline uses native select element
    await expect(page.locator("select").first()).toBeVisible();
  });

  test("should display period count summary", async ({ page }) => {
    // Stats cards show Total Notes, Periods, etc.
    await expect(page.locator("text=Total Notes")).toBeVisible();
    await expect(page.locator("text=Periods")).toBeVisible();
  });

  test("should filter by tag", async ({ page }) => {
    // Select a tag from the dropdown
    await page.locator("select").first().selectOption({ index: 1 });

    // Chart should still be visible after filtering
    await expect(page.locator(".recharts-wrapper")).toBeVisible();
  });
});