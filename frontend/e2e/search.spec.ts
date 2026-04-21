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
    // Search uses SearchAutocomplete with "Enter your search query..." placeholder
    const searchInput = page.locator('[data-search-input]');
    await expect(searchInput).toBeVisible();
  });

  test("should perform search and display results", async ({ page }) => {
    const searchInput = page.locator('[data-search-input]');
    await searchInput.fill("management");
    await page.getByRole("button", { name: "Search" }).click();

    await expect(page.locator("h3:has-text('1:1 with Alice - March 2024')")).toBeVisible();
    await expect(page.locator("h3:has-text('Zendesk Chat Architecture Review')")).toBeVisible();
    await expect(page.locator("text=Score:").first()).toBeVisible();
  });

  test("should have filter controls", async ({ page }) => {
    // Start fresh - ensure no search has been performed
    await page.goto("/search");
    await page.waitForTimeout(100);

    // Click Filters button to show filter panel
    await page.locator('[data-testid="filter-toggle"]').click();
    await page.waitForTimeout(100);

    // Filter panel should be visible
    await expect(page.locator('[data-testid="filter-panel"]')).toBeVisible();

    // Source filter uses buttons
    await expect(page.locator('[data-testid="filter-source-all"]')).toBeVisible();

    // Folder filter input - has placeholder "Filter by folder..."
    await expect(page.locator('input[placeholder="Filter by folder..."]')).toBeVisible();

    // Tags section (Popular tags) - only visible when !searched
    await expect(page.locator('[data-testid="popular-tags-label"]')).toBeVisible();

    // Date range picker
    await expect(page.locator('[data-testid="date-range-picker"]')).toBeVisible();
  });

  test("should filter by source", async ({ page }) => {
    // Start fresh
    await page.goto("/search");
    await page.waitForTimeout(100);

    // Click Filters button to show filter panel
    await page.locator('[data-testid="filter-toggle"]').click();
    await page.waitForTimeout(100);

    // Source buttons: All, Apple Notes, Evernote
    const appleNotesButton = page.locator('[data-testid="filter-source-Apple Notes"]');
    await appleNotesButton.click();

    // After selecting, the filter should have data-active="true"
    await expect(appleNotesButton).toHaveAttribute("data-active", "true");
  });

  test("should navigate to note from search result", async ({ page }) => {
    await page.locator('[data-search-input]').fill("Alice");
    await page.getByRole("button", { name: "Search" }).click();

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

    await page.locator('[data-search-input]').fill("xyznonexistent");
    await page.getByRole("button", { name: "Search" }).click();

    await expect(page.locator("text=No results found")).toBeVisible();
  });
});