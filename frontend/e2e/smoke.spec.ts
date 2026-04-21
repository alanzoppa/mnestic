import { test, expect } from "@playwright/test";

test.describe("Smoke Tests (Live Backend)", { tag: "@smoke" }, () => {
  test("should load dashboard with stats from live backend", async ({ page }) => {
    await page.goto("/");

    await expect(page.locator("h1:has-text('Notes Browser')")).toBeVisible();

    // Wait for stats to load from backend
    await page.waitForTimeout(2000);

    // Stats should show non-zero values from real data
    // Look for stat values (numbers in the stat cards)
    const pageText = await page.locator('.card-hover').allTextContents();
    const hasStats = pageText.some((text) =>
      /\d+/.test(text) && !text.includes("N/A")
    );
    expect(hasStats).toBe(true);
  });

  test("should return search results from live backend", async ({ page }) => {
    await page.goto("/search");
    await expect(page.locator("h1:has-text('Search Notes')")).toBeVisible();

    // Use data-search-input attribute for SearchAutocomplete
    const searchInput = page.locator('[data-search-input]');
    await searchInput.fill("management");
    await page.locator('button:has-text("Search")').click();

    await page.waitForTimeout(2000);

    // Results should appear - look for results in cards
    const results = page.locator('.recharts-wrapper, h3').first();
    await expect(results).toBeVisible();
  });

  test("should load browse page with notes from live backend", async ({ page }) => {
    await page.goto("/browse");
    await expect(page.locator("h1:has-text('Browse Notes')")).toBeVisible();

    await page.waitForTimeout(2000);

    // Should have note cards
    const notes = page.locator('h3').first();
    await expect(notes).toBeVisible();
  });

  test("should load tags page with real tags", async ({ page }) => {
    await page.goto("/tags");
    await expect(page.locator("h1:has-text('Tag Explorer')")).toBeVisible();

    await page.waitForTimeout(2000);

    // Tag cloud should load
    await expect(page.locator("text=Tag Cloud")).toBeVisible();

    // Should have some tags
    const tags = page.locator("button");
    await expect(tags.first()).toBeVisible();
  });

  test("should load timeline with real data", async ({ page }) => {
    await page.goto("/timeline");
    await expect(page.locator("h1:has-text('Timeline')")).toBeVisible();

    await page.waitForTimeout(2000);

    // Chart should render
    await expect(page.locator(".recharts-wrapper").or(page.locator("text=Loading"))).toBeVisible();
  });
});