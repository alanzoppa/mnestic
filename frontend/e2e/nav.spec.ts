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
    // Use getByRole to avoid matching "Archive Browser" in logo
    await expect(nav.getByRole("link", { name: "Dashboard", exact: true })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Search", exact: true })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Browse", exact: true })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Tags", exact: true })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Timeline", exact: true })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Calendar", exact: true })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Graph", exact: true })).toBeVisible();
  });

  test("should highlight active page in nav", async ({ page }) => {
    const nav = page.locator("nav");
    
    await page.goto("/");
    // Active state uses gradient background with blue colors
    await expect(nav.getByRole("link", { name: "Dashboard", exact: true })).toHaveClass(/from-blue-600/);

    await page.goto("/search");
    await expect(nav.getByRole("link", { name: "Search", exact: true })).toHaveClass(/from-blue-600/);

    await page.goto("/browse");
    await expect(nav.getByRole("link", { name: "Browse", exact: true })).toHaveClass(/from-blue-600/);
  });

  test("should navigate to Search page", async ({ page }) => {
    await page.goto("/");
    const nav = page.locator("nav");
    await nav.getByRole("link", { name: "Search", exact: true }).click();
    await expect(page).toHaveURL(/\/search/);
    await expect(page.getByRole('heading', { name: 'Search Notes' })).toBeVisible();
  });

  test("should navigate to Browse page", async ({ page }) => {
    await page.goto("/");
    const nav = page.locator("nav");
    await nav.getByRole("link", { name: "Browse", exact: true }).click();
    await expect(page).toHaveURL(/\/browse/);
    await expect(page.getByRole('heading', { name: 'Browse Notes' })).toBeVisible();
  });

  test("should navigate to Tags page", async ({ page }) => {
    await page.goto("/");
    const nav = page.locator("nav");
    await nav.getByRole("link", { name: "Tags", exact: true }).click();
    await expect(page).toHaveURL(/\/tags$/);
    await expect(page.getByRole('heading', { name: 'Tag Explorer' })).toBeVisible();
  });

  test("should navigate to Timeline page", async ({ page }) => {
    await page.goto("/");
    const nav = page.locator("nav");
    await nav.getByRole("link", { name: "Timeline", exact: true }).click();
    await expect(page).toHaveURL(/\/timeline/);
    await expect(page.getByRole('heading', { name: 'Timeline' })).toBeVisible();
  });

  test("should navigate to Calendar page", async ({ page }) => {
    await page.goto("/");
    const nav = page.locator("nav");
    await nav.getByRole("link", { name: "Calendar", exact: true }).click();
    await expect(page).toHaveURL(/\/calendar/);
    await expect(page.getByRole('heading', { name: 'Calendar' })).toBeVisible();
  });

  test("should navigate to Graph page", async ({ page }) => {
    await page.goto("/");
    const nav = page.locator("nav");
    await nav.getByRole("link", { name: "Graph", exact: true }).click();
    await expect(page).toHaveURL(/\/graph/);
    await expect(page.getByRole('heading', { name: 'Similarity Graph' })).toBeVisible();
  });

  test("should persist across page navigations", async ({ page }) => {
    const nav = page.locator("nav");
    await page.goto("/");

    await nav.getByRole("link", { name: "Tags", exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Tag Explorer' })).toBeVisible();

    await nav.getByRole("link", { name: "Calendar", exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Calendar' })).toBeVisible();

    await nav.getByRole("link", { name: "Dashboard", exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Notes Browser' })).toBeVisible();
  });
});