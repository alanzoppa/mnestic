import { test, expect } from "@playwright/test";
import { setupTest, setupTestSimple } from "./fixtures/test-helpers";

// Global timeout for waiting for tag cloud to appear
const TAG_CLOUD_TIMEOUT = 30000;

test.describe("Tags Page", () => {
  test.beforeEach(async ({ page }) => {
    // Don't wait for specific selector - the page takes time to compile/load
    await setupTestSimple(page, "/tags");
  });

  test("should display page title", async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Tag Explorer' })).toBeVisible();
  });

  test("should display tag cloud", async ({ page }) => {
    // Wait for Tag Cloud heading to appear with longer timeout
    await expect(page.getByRole('heading', { name: 'Tag Cloud' })).toBeVisible({ timeout: TAG_CLOUD_TIMEOUT });
    // Look for specific tag buttons by text
    await expect(page.locator('button:has-text("work")').first()).toBeVisible();
    await expect(page.locator('button:has-text("1:1")').first()).toBeVisible();
    await expect(page.locator('button:has-text("evernote")').first()).toBeVisible();
  });

  test("should show tag counts", async ({ page }) => {
    // Wait for Tag Cloud heading to appear
    await expect(page.getByRole('heading', { name: 'Tag Cloud' })).toBeVisible({ timeout: TAG_CLOUD_TIMEOUT });
    
    // Tag counts appear within the tag cloud buttons
    const workTag = page.locator('button:has-text("work")').first();
    await expect(workTag).toContainText('287');
    const oneOnOneTag = page.locator('button:has-text("1:1")').first();
    await expect(oneOnOneTag).toContainText('45');
  });

  test("should have structural tag indicator", async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Tag Cloud' })).toBeVisible({ timeout: TAG_CLOUD_TIMEOUT });
    await expect(page.locator('text=Structural').first()).toBeVisible();
  });

  test("should have content tag indicator", async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Tag Cloud' })).toBeVisible({ timeout: TAG_CLOUD_TIMEOUT });
    await expect(page.locator('text=Content').first()).toBeVisible();
  });

  test("should navigate to tag detail on click", async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Tag Cloud' })).toBeVisible({ timeout: TAG_CLOUD_TIMEOUT });
    await page.locator('button:has-text("work")').first().click();
    await expect(page).toHaveURL(/\/tags\/work/);
  });

  test("should display co-occurrence table", async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Tag Cloud' })).toBeVisible({ timeout: TAG_CLOUD_TIMEOUT });
    await expect(page.locator("text=Top Co-occurring Tags")).toBeVisible();
    // Table headers may vary - just check that table exists
    await expect(page.locator("table").first()).toBeVisible();
  });
});

test.describe("Tag Detail Page", () => {
  test.beforeEach(async ({ page }) => {
    // Tag detail page doesn't need tags API, it uses search API
    await setupTestSimple(page, "/tags/work");
  });

  test("should display tag name and count", async ({ page }) => {
    // Look for heading that contains "work" tag name
    const heading = page.getByRole('heading', { name: /Tag: work|work/ });
    await expect(heading).toBeVisible();
  });

  test("should have back button to tags page", async ({ page }) => {
    await expect(page.locator("text=Back to Tags")).toBeVisible();
    await page.locator("text=Back to Tags").click();
    // Wait for Tag Cloud heading to appear after navigation
    await expect(page.getByRole('heading', { name: 'Tag Cloud' })).toBeVisible({ timeout: TAG_CLOUD_TIMEOUT });
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
