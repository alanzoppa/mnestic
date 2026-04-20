import { test, expect } from "@playwright/test";
import { mockApiRoutes } from "./fixtures/mock-router";

test.describe("Navigation", () => {
  test.beforeEach(async ({ page }) => {
    await mockApiRoutes(page);
  });

  test("should display all nav links", async ({ page }) => {
    await page.goto("/");

    const nav = page.locator("nav");
    await expect(nav).toBeVisible();
    await expect(nav.locator("a:has-text('Dashboard')")).toBeVisible();
    await expect(nav.locator("a:has-text('Search')")).toBeVisible();
    await expect(nav.locator("a:has-text('Browse')")).toBeVisible();
    await expect(nav.locator("a:has-text('Tags')")).toBeVisible();
    await expect(nav.locator("a:has-text('Timeline')")).toBeVisible();
    await expect(nav.locator("a:has-text('Calendar')")).toBeVisible();
    await expect(nav.locator("a:has-text('Graph')")).toBeVisible();
  });

  test("should highlight active page in nav", async ({ page }) => {
    const nav = page.locator("nav");
    
    await page.goto("/");
    await expect(nav.locator("a:has-text('Dashboard')")).toHaveClass(/bg-zinc-700/);

    await page.goto("/search");
    await expect(nav.locator("a:has-text('Search')")).toHaveClass(/bg-zinc-700/);

    await page.goto("/browse");
    await expect(nav.locator("a:has-text('Browse')")).toHaveClass(/bg-zinc-700/);
  });

  test("should navigate to Search page", async ({ page }) => {
    await page.goto("/");
    await page.locator("nav a:has-text('Search')").click();
    await expect(page).toHaveURL(/\/search/);
    await expect(page.getByRole('heading', { name: 'Search Notes' })).toBeVisible();
  });

  test("should navigate to Browse page", async ({ page }) => {
    await page.goto("/");
    await page.locator("nav a:has-text('Browse')").click();
    await expect(page).toHaveURL(/\/browse/);
    await expect(page.getByRole('heading', { name: 'Browse Notes' })).toBeVisible();
  });

  test("should navigate to Tags page", async ({ page }) => {
    await page.goto("/");
    await page.locator("nav a:has-text('Tags')").click();
    await expect(page).toHaveURL(/\/tags$/);
    await expect(page.getByRole('heading', { name: 'Tag Explorer' })).toBeVisible();
  });

  test("should navigate to Timeline page", async ({ page }) => {
    await page.goto("/");
    await page.locator("nav a:has-text('Timeline')").click();
    await expect(page).toHaveURL(/\/timeline/);
    await expect(page.getByRole('heading', { name: 'Timeline' })).toBeVisible();
  });

  test("should navigate to Calendar page", async ({ page }) => {
    await page.goto("/");
    await page.locator("nav a:has-text('Calendar')").click();
    await expect(page).toHaveURL(/\/calendar/);
    await expect(page.getByRole('heading', { name: 'Calendar' })).toBeVisible();
  });

  test("should navigate to Graph page", async ({ page }) => {
    await page.goto("/");
    await page.locator("nav a:has-text('Graph')").click();
    await expect(page).toHaveURL(/\/graph/);
    await expect(page.getByRole('heading', { name: 'Similarity Graph' })).toBeVisible();
  });

  test("should persist across page navigations", async ({ page }) => {
    await page.goto("/");

    await page.locator("nav a:has-text('Tags')").click();
    await expect(page.getByRole('heading', { name: 'Tag Explorer' })).toBeVisible();

    await page.locator("nav a:has-text('Calendar')").click();
    await expect(page.getByRole('heading', { name: 'Calendar' })).toBeVisible();

    await page.locator("nav a:has-text('Dashboard')").click();
    await expect(page.getByRole('heading', { name: 'Notes Browser' })).toBeVisible();
  });
});
