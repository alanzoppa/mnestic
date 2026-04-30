import { test, expect } from "@playwright/test";
import { mockApiRoutes } from "./fixtures/mock-router";
import { mockCreatedNote } from "./fixtures/api-fixtures";

test.describe("Create Note Page", () => {
  test.beforeEach(async ({ page }) => {
    await mockApiRoutes(page);
    await page.goto("/create");
  });

  test("should display create note form", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "New Note" })).toBeVisible();
    await expect(page.locator('[data-testid="create-title"]')).toBeVisible();
    await expect(page.locator('[data-testid="create-content"]')).toBeVisible();
    await expect(page.locator('[data-testid="create-folder"]')).toBeVisible();
    await expect(page.locator('[data-testid="create-submit"]')).toBeVisible();
    await expect(page.locator('[data-testid="create-cancel"]')).toBeVisible();
  });

  test("submits form and redirects to note detail", async ({ page }) => {
    // Intercept GET /api/notes/{id} to return the created note after redirect
    await page.route(`**/api/notes/${mockCreatedNote.id}`, async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockCreatedNote),
        });
        return;
      }
      await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    });

    await page.locator('[data-testid="create-title"]').fill("Newly Created Note");
    await page.locator('[data-testid="create-content"]').fill("Hello world, this is a new note.");

    await page.locator('[data-testid="create-submit"]').click();

    await expect(page).toHaveURL(/\/notes\/manual_abc123/);
    await expect(page.getByRole("heading", { name: "Newly Created Note" }).first()).toBeVisible();
  });

  test("cancel button goes back", async ({ page }) => {
    await page.locator('[data-testid="create-cancel"]').click();

    // Should not be on /create anymore
    await expect(page).not.toHaveURL(/\/create$/);
  });

  test("folder dropdown is populated from schema", async ({ page }) => {
    // Wait for schema to load
    await page.waitForTimeout(500);

    const folderSelect = page.locator('[data-testid="create-folder"]');
    await expect(folderSelect).toBeVisible();

    // Check that the select has options
    const options = await folderSelect.locator("option").allTextContents();
    expect(options.length).toBeGreaterThan(1);
    expect(options.some(o => o === "Notes" || o.includes("Notes"))).toBeTruthy();
  });

  test("can select a different folder", async ({ page }) => {
    // Wait for folder options to load
    await page.waitForTimeout(500);

    const folderSelect = page.locator('[data-testid="create-folder"]');

    // Get initial value
    const initialValue = await folderSelect.inputValue();

    // Select a different option if available
    const options = await folderSelect.locator("option").allTextContents();
    if (options.length > 1) {
      await folderSelect.selectOption({ index: 1 });
      const newValue = await folderSelect.inputValue();
      expect(newValue).not.toBe(initialValue);
    }
  });
});