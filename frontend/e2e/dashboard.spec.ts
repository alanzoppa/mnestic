import { test, expect } from "@playwright/test";
import { mockApiRoutes } from "./fixtures/mock-router";

test.describe("Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await mockApiRoutes(page);
    await page.goto("/");
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

  test("should display app title and stats", async ({ page }) => {
    // Main page heading should be Notes Browser
    const mainContent = page.locator("main");
    await expect(mainContent.getByRole('heading', { name: 'Notes Browser' })).toBeVisible();

    // Stats should be visible
    await expect(mainContent.locator("text=Total Notes")).toBeVisible();
    await expect(mainContent.locator("text=1,641")).toBeVisible();
    await expect(mainContent.locator("text=Unique Tags")).toBeVisible();
    await expect(mainContent.locator("text=Calendar Events")).toBeVisible();
    await expect(mainContent.locator("text=Date Range")).toBeVisible();
  });

  test("should have ingest management buttons", async ({ page }) => {
    const mainContent = page.locator("main");
    await expect(mainContent.locator("text=Index Management")).toBeVisible();

    const incrementalBtn = mainContent.locator('button:has-text("Incremental Ingest")');
    const fullBtn = mainContent.locator('button:has-text("Full Re-ingest")');

    await expect(incrementalBtn).toBeVisible();
    await expect(fullBtn).toBeVisible();
  });

  test("should trigger incremental ingest and show result", async ({ page }) => {
    const mainContent = page.locator("main");
    const incrementalBtn = mainContent.locator('button:has-text("Incremental Ingest")');
    await incrementalBtn.click();

    // Result should appear after ingest completes
    await expect(mainContent.locator("text=Notes:")).toBeVisible({ timeout: 5000 });
  });

  test("should have navigation links to other pages", async ({ page }) => {
    const mainContent = page.locator("main");
    await expect(mainContent.locator('a:has-text("Advanced Search")')).toBeVisible();
    await expect(mainContent.locator('a:has-text("Browse All")')).toBeVisible();
  });

  test("should navigate to search page via Advanced Search link", async ({ page }) => {
    await page.locator('a:has-text("Advanced Search")').click();
    await expect(page).toHaveURL(/\/search/);
    await expect(page.getByRole('heading', { name: 'Search Notes' })).toBeVisible();
  });

  test("should navigate to browse page via Browse All link", async ({ page }) => {
    await page.locator('a:has-text("Browse All")').click();
    await expect(page).toHaveURL(/\/browse/);
    await expect(page.getByRole('heading', { name: 'Browse Notes' })).toBeVisible();
  });
});