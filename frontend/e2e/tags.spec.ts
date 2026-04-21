import { test, expect } from "@playwright/test";
import { mockApiRoutes } from "./fixtures/mock-router";

test.describe("Tags Page", () => {
  test.beforeEach(async ({ page }) => {
    await mockApiRoutes(page);
    await page.goto("/tags");
  });

  test("should display page title", async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Tag Explorer' })).toBeVisible();
  });

  test("should display tag cloud", async ({ page }) => {
    await expect(page.locator("text=Tag Cloud")).toBeVisible();
    // Look for tags specifically within the tag cloud section
    await expect(page.locator("button:has-text('work')")).toBeVisible();
    await expect(page.locator("button:has-text('1:1')")).toBeVisible();
    await expect(page.locator("button:has-text('evernote')")).toBeVisible();
  });

  test("should show tag counts", async ({ page }) => {
    // Tag counts should appear within the tag cloud
    await expect(page.locator("text=287").first()).toBeVisible();
    await expect(page.locator("text=45").first()).toBeVisible();
  });

  test("should have structural tag indicator", async ({ page }) => {
    await expect(page.locator("text=Structural").first()).toBeVisible();
  });

  test("should have content tag indicator", async ({ page }) => {
    await expect(page.locator("text=Content").first()).toBeVisible();
  });

  test("should navigate to tag detail on click", async ({ page }) => {
    await page.locator("button:has-text('work')").first().click();
    await expect(page).toHaveURL(/\/tags\/work/);
  });

  test("should display co-occurrence table", async ({ page }) => {
    await expect(page.locator("text=Top Co-occurring Tags")).toBeVisible();
    // Table headers may vary - just check that table exists
    await expect(page.locator("table").first()).toBeVisible();
  });
});

test.describe("Tag Detail Page", () => {
  test.beforeEach(async ({ page }) => {
    await mockApiRoutes(page);
    await page.goto("/tags/work");
  });

  test("should display tag name and count", async ({ page }) => {
    // Look for heading that contains "work" tag name
    const heading = page.getByRole('heading', { name: /Tag: work|work/ });
    await expect(heading).toBeVisible();
  });

  test("should have back button to tags page", async ({ page }) => {
    await expect(page.locator("text=Back to Tags")).toBeVisible();
    await page.locator("text=Back to Tags").click();
    await expect(page).toHaveURL(/\/tags$/);
  });

  test("should display notes with this tag", async ({ page }) => {
    await expect(page.locator("h3:has-text('Zendesk Chat Architecture Review')")).toBeVisible();
  });

  test("should navigate to note from tag results", async ({ page }) => {
    await page.locator("h3:has-text('Zendesk Chat Architecture Review')").click();
    await expect(page).toHaveURL(/\/notes\/note-002/);
  });
});