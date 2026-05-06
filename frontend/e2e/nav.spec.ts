import { test, expect } from "@playwright/test";
import { mockApiRoutes } from "./fixtures/mock-router";

// Global timeout for waiting for page to load
const PAGE_LOAD_TIMEOUT = 20000;

test.describe("Navigation", () => {
  test.beforeEach(async ({ page }) => {
    await mockApiRoutes(page, { debug: true });
  });

  test("should display all nav links", async ({ page }) => {
    await page.goto("/");
    const nav = page.locator("nav");
    await expect(nav).toBeVisible();
    // Use getByRole with exact:true to match only nav links, not the logo brand link
    await expect(nav.getByRole("link", { name: "Dashboard", exact: true })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Search", exact: true })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Browse", exact: true })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Tags", exact: true })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Timeline", exact: true })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Calendar", exact: true })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Graph", exact: true })).toBeVisible();
  });

  test("should show mobile toggle below lg", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/");
    const toggle = page.locator('[data-testid="mobile-nav-toggle"]');
    await expect(toggle).toBeVisible();
    // sidebar should be hidden initially
    await expect(page.locator("nav")).not.toBeInViewport();
  });

  test("should open and close mobile sidebar", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/");

    const toggle = page.locator('[data-testid="mobile-nav-toggle"]');
    const nav = page.locator("nav");

    // open
    await toggle.click();
    await expect(nav).toBeInViewport();
    await expect(page.locator('[data-testid="mobile-nav-backdrop"]')).toBeVisible();

    // click nav link closes sidebar
    await nav.getByRole("link", { name: "Search", exact: true }).click();
    await expect(page).toHaveURL(/\/search/);
    await expect(nav).not.toBeInViewport();
  });

  test("should close mobile sidebar on backdrop click", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/");

    const toggle = page.locator('[data-testid="mobile-nav-toggle"]');
    const nav = page.locator("nav");

    await toggle.click();
    await expect(nav).toBeInViewport();

    await page.locator('[data-testid="mobile-nav-backdrop"]').click();
    await expect(nav).not.toBeInViewport();
  });

  test("should highlight active page in nav", async ({ page }) => {
    const nav = page.locator("nav");

    await page.goto("/");
    await expect(nav.getByRole("link", { name: "Dashboard", exact: true })).toHaveAttribute("aria-current", "page");

    await page.goto("/search");
    await expect(nav.getByRole("link", { name: "Search", exact: true })).toHaveAttribute("aria-current", "page");

    await page.goto("/browse");
    await expect(nav.getByRole("link", { name: "Browse", exact: true })).toHaveAttribute("aria-current", "page");
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
    // Wait for loading to finish
    await page.waitForFunction(() => {
      const loadingEl = document.querySelector('p');
      return !loadingEl || loadingEl.textContent !== 'Loading...';
    }, { timeout: PAGE_LOAD_TIMEOUT });
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

    // Navigate to Tags page
    await nav.getByRole("link", { name: "Tags", exact: true }).click();
    // Wait for loading to finish
    await page.waitForFunction(() => {
      const loadingEl = document.querySelector('p');
      return !loadingEl || loadingEl.textContent !== 'Loading...';
    }, { timeout: PAGE_LOAD_TIMEOUT });
    await expect(page.getByRole('heading', { name: 'Tag Explorer' })).toBeVisible();

    // Navigate to Calendar page
    await nav.getByRole("link", { name: "Calendar", exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Calendar' })).toBeVisible();

    // Navigate to Dashboard
    await nav.getByRole("link", { name: "Dashboard", exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Mnestic' })).toBeVisible();
  });
});
