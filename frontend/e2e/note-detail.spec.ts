import { test, expect } from "@playwright/test";
import { mockApiRoutes } from "./fixtures/mock-router";

test.describe("Note Detail Page", () => {
  test.beforeEach(async ({ page }) => {
    await mockApiRoutes(page);
    await page.goto("/notes/note-001");
  });

  test("should display note title", async ({ page }) => {
    await expect(page.getByRole('heading', { name: '1:1 with Alice - March 2024' })).toBeVisible();
  });

  test("should display note metadata", async ({ page }) => {
    // Use more specific selectors to avoid matching sidebar nav
    await expect(page.locator("header span:has-text('1:1 Notes')")).toBeVisible();
    await expect(page.locator("header span:has-text('Apple Notes')")).toBeVisible();
    await expect(page.locator("div:has-text('Created:'):not(nav *)").first()).toBeVisible();
    await expect(page.locator("div:has-text('Modified:'):not(nav *)").first()).toBeVisible();
  });

  test("should display tags as clickable links", async ({ page }) => {
    // Look for tags in the note content area, not the sidebar
    const tags = page.locator("header a:has-text('1:1')");
    await expect(tags).toBeVisible();
    const managementTag = page.locator("header a:has-text('management')");
    await expect(managementTag).toBeVisible();
  });

  test("should display participants", async ({ page }) => {
    // Participants are in the header area
    await expect(page.locator("header span:has-text('Alice')")).toBeVisible();
  });

  test("should display note content", async ({ page }) => {
    await expect(page.locator(".markdown-body:has-text('Performance review preparation')")).toBeVisible();
    await expect(page.locator(".markdown-body:has-text('Career progression discussion')")).toBeVisible();
    await expect(page.locator(".markdown-body:has-text('Next Steps')")).toBeVisible();
  });

  test("should display same-day calendar events sidebar", async ({ page }) => {
    await expect(page.locator("h3:has-text('Same-day Events')")).toBeVisible();
    await expect(page.locator("div:has-text('1:1 Alice')").first()).toBeVisible();
    await expect(page.locator("div:has-text('Conference Room A')").first()).toBeVisible();
  });

  test("should display similar notes sidebar", async ({ page }) => {
    await expect(page.locator("h3:has-text('Similar Notes')")).toBeVisible();
    await expect(page.locator("div:has-text('1:1 with Alice - February 2024')")).toBeVisible();
    await expect(page.locator("div:has-text('1:1 with Alice - January 2024')")).toBeVisible();
  });

  test("should navigate to similar note on click", async ({ page }) => {
    await page.locator("div:has-text('1:1 with Alice - February 2024')").click();
    await expect(page).toHaveURL(/\/notes\/note-004/);
  });

  test("should have back navigation", async ({ page }) => {
    await expect(page.locator("button:has-text('Back')")).toBeVisible();
    await page.locator("button:has-text('Back')").click();
    await expect(page).not.toHaveURL(/\/notes\//);
  });

  test("should navigate to tag page when tag clicked", async ({ page }) => {
    await page.locator("header a:has-text('management')").click();
    await expect(page).toHaveURL(/\/tags\/management/);
  });
});
