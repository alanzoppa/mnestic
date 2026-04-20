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

  test("should display chart", async ({ page }) => {
    await expect(page.locator(".recharts-wrapper")).toBeVisible();
  });

  test("should have tag filter dropdown", async ({ page }) => {
    await expect(page.locator("select")).toBeVisible();
    // The dropdown may contain different options based on the hardcoded TAGS list
  });

  test("should display period count summary", async ({ page }) => {
    await expect(page.locator("text=notes across")).toBeVisible();
    await expect(page.locator("text=periods")).toBeVisible();
  });

  test("should filter by tag", async ({ page }) => {
    // Select the first available option (not "All tags")
    await page.locator("select").selectOption({ index: 1 });
    await page.waitForTimeout(100);

    // Chart should still be visible after filtering
    await expect(page.locator(".recharts-wrapper")).toBeVisible();
  });
});
