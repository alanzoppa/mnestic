import { test, expect } from "@playwright/test";
import { mockApiRoutes } from "./fixtures/mock-router";

test.describe("Search Page", () => {
  test.beforeEach(async ({ page }) => {
    await mockApiRoutes(page);
    await page.goto("/search");
  });

  test("should display search page title", async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Search Notes' })).toBeVisible();
  });

  test("should have search input with placeholder", async ({ page }) => {
    const searchInput = page.locator('input[placeholder="Search your notes..."]');
    await expect(searchInput).toBeVisible();
    await expect(searchInput).toHaveAttribute("placeholder", "Search your notes...");
  });

  test("should perform search and display results", async ({ page }) => {
    const searchInput = page.locator('input[placeholder="Search your notes..."]');
    await searchInput.fill("management");
    await page.locator('button:has-text("Search")').click();

    await expect(page.locator("h3:has-text('1:1 with Alice - March 2024')")).toBeVisible();
    await expect(page.locator("h3:has-text('Zendesk Chat Architecture Review')")).toBeVisible();
    await expect(page.locator("text=Score:").first()).toBeVisible();
  });

  test("should have filter controls", async ({ page }) => {
    // Source filter
    await expect(page.locator('select:has-text("All Sources")')).toBeVisible();

    // Folder filter
    await expect(page.locator('input[placeholder="Folder"]')).toBeVisible();

    // Tags filter
    await expect(page.locator('input[placeholder="Tags (comma sep)"]')).toBeVisible();

    // Date range filters
    await expect(page.locator('input[type="date"]')).toHaveCount(2);
  });

  test("should filter by source", async ({ page }) => {
    await page.locator('select').selectOption("Apple Notes");
    // After selecting, the filter should be applied
    await expect(page.locator('select').first()).toHaveValue("Apple Notes");
  });

  test("should navigate to note from search result", async ({ page }) => {
    await page.locator('input[placeholder="Search your notes..."]').fill("Alice");
    await page.locator('button:has-text("Search")').click();

    await page.locator("h3:has-text('1:1 with Alice - March 2024')").click();
    await expect(page).toHaveURL(/\/notes\/note-001/);
  });

  test("should show empty state when no results", async ({ page }) => {
    await page.route("**/api/search", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ results: [] }),
      });
    });

    await page.locator('input[placeholder="Search your notes..."]').fill("xyznonexistent");
    await page.locator('button:has-text("Search")').click();

    await expect(page.locator("text=No results found")).toBeVisible();
  });
});
