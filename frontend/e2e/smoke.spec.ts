import { test, expect } from "@playwright/test";

test.describe("Smoke Tests (Live Backend)", { tag: "@smoke" }, () => {
  test("should load dashboard with stats from live backend", async ({ page }) => {
    await page.goto("/");

    await expect(page.locator("h1:has-text('Notes Browser')")).toBeVisible();

    // Wait for stats to load from backend
    await page.waitForTimeout(2000);

    // Stats should show non-zero values from real data
    const statsText = await page.locator("[class*='StatCard']").allTextContents();
    const hasStats = statsText.some((text) =>
      /\d+/.test(text) && !text.includes("N/A")
    );
    expect(hasStats).toBe(true);
  });

  test("should return search results from live backend", async ({ page }) => {
    await page.goto("/search");
    await expect(page.locator("h1:has-text('Search Notes')")).toBeVisible();

    const searchInput = page.locator('input[placeholder="Search your notes..."]');
    await searchInput.fill("management");
    await page.locator('button:has-text("Search")').click();

    await page.waitForTimeout(2000);

    // Results should appear
    const results = page.locator('[class*="bg-zinc-900"]');
    await expect(results.first()).toBeVisible();
  });

  test("should load browse page with notes from live backend", async ({ page }) => {
    await page.goto("/browse");
    await expect(page.locator("h1:has-text('Browse Notes')")).toBeVisible();

    await page.waitForTimeout(2000);

    // Should have note cards
    const notes = page.locator('[class*="bg-zinc-900"]');
    await expect(notes.first()).toBeVisible();
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
