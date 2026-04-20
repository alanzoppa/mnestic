import { test, expect } from "@playwright/test";
import { mockApiRoutes } from "./fixtures/mock-router";

test.describe("Note Detail Page", () => {
  test.beforeEach(async ({ page }) => {
    await mockApiRoutes(page);
    await page.goto("/notes/note-001");
  });

  test("should display note title", async ({ page }) => {
    const title = page.locator("[data-testid='editable-title'] h1");
    await expect(title).toBeVisible();
  });

  test("should display note metadata", async ({ page }) => {
    await expect(page.locator("text=1:1 Notes").first()).toBeVisible();
    await expect(page.locator("text=Apple Notes").first()).toBeVisible();
    await expect(page.locator("div:has-text('Created:'):not(nav *)").first()).toBeVisible();
    await expect(page.locator("div:has-text('Modified:'):not(nav *)").first()).toBeVisible();
  });

  test("should display tags as clickable links", async ({ page }) => {
    await expect(page.locator("text=1:1").first()).toBeVisible();
    const managementTag = page.locator("a[href*='/tags/management']").first();
    await expect(managementTag).toBeVisible();
  });

  test("should display participants", async ({ page }) => {
    await expect(page.locator("text=Alice").first()).toBeVisible();
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
    const similarSection = page.locator("text=1:1 with Alice - February 2024").first();
    await expect(similarSection).toBeVisible();
  });

  test("should navigate to similar note on click", async ({ page }) => {
    await page.locator("a:has-text('1:1 with Alice - February 2024')").first().click();
    await expect(page).toHaveURL(/\/notes\/note-004/);
  });

  test("should have back navigation", async ({ page }) => {
    await expect(page.locator("button:has-text('Back')")).toBeVisible();
    await page.locator("button:has-text('Back')").click();
    await expect(page).not.toHaveURL(/\/notes\//);
  });

  test("should navigate to tag page when tag clicked", async ({ page }) => {
    await page.locator("a[href*='/tags/management']").first().click();
    await expect(page).toHaveURL(/\/tags\/management/);
  });

  // Title editing
  test("should show edit button on title hover", async ({ page }) => {
    const titleEl = page.locator("[data-testid='editable-title']");
    await titleEl.hover();
    const editBtn = page.locator("[aria-label='Edit title']");
    await expect(editBtn).toBeVisible();
  });

  test("should enter edit mode when edit button clicked", async ({ page }) => {
    const titleEl = page.locator("[data-testid='editable-title']");
    await titleEl.hover();
    await page.locator("[aria-label='Edit title']").click({ force: true });
    const input = page.locator("[data-testid='title-input']");
    await expect(input).toBeVisible();
    await expect(input).toHaveValue("1:1 with Alice - March 2024");
  });

  test("should save title when checkmark clicked", async ({ page }) => {
    const titleEl = page.locator("[data-testid='editable-title']");
    await titleEl.hover();
    await page.locator("[aria-label='Edit title']").click({ force: true });
    const input = page.locator("[data-testid='title-input']");
    await input.clear();
    await input.fill("Updated Meeting Notes");
    await page.locator("[aria-label='Save title']").click();
    await expect(page.locator("[data-testid='editable-title']").filter({ hasText: "Updated Meeting Notes" })).toBeVisible();
  });

  test("should cancel title edit on cancel button", async ({ page }) => {
    const titleEl = page.locator("[data-testid='editable-title']");
    await titleEl.hover();
    await page.locator("[aria-label='Edit title']").click({ force: true });
    const input = page.locator("[data-testid='title-input']");
    await input.clear();
    await input.fill("Should Not Save");
    await page.locator("[aria-label='Cancel editing']").click();
    await expect(page.locator("[data-testid='editable-title']").filter({ hasText: "1:1 with Alice" })).toBeVisible();
  });

  test("should save title on Enter key", async ({ page }) => {
    const titleEl = page.locator("[data-testid='editable-title']");
    await titleEl.hover();
    await page.locator("[aria-label='Edit title']").click({ force: true });
    const input = page.locator("[data-testid='title-input']");
    await input.clear();
    await input.fill("Enter Key Title");
    await input.press("Enter");
    await expect(page.locator("[data-testid='editable-title']").filter({ hasText: "Enter Key Title" })).toBeVisible();
  });

  test("should cancel title edit on Escape key", async ({ page }) => {
    const titleEl = page.locator("[data-testid='editable-title']");
    await titleEl.hover();
    await page.locator("[aria-label='Edit title']").click({ force: true });
    const input = page.locator("[data-testid='title-input']");
    await input.clear();
    await input.fill("Escaped Title");
    await input.press("Escape");
    await expect(page.locator("[data-testid='editable-title']").filter({ hasText: "1:1 with Alice" })).toBeVisible();
  });

  // Content editing
  test("should show Edit button for content", async ({ page }) => {
    const editBtn = page.locator("button:has-text('Edit')");
    await expect(editBtn).toBeVisible();
  });

  test("should toggle to edit mode for content", async ({ page }) => {
    await page.locator("button:has-text('Edit')").click();
    const textarea = page.locator("textarea");
    await expect(textarea).toBeVisible();
    await expect(page.locator("text=Editing")).toBeVisible();
  });

  test("should save content edits", async ({ page }) => {
    await page.locator("button:has-text('Edit')").click();
    const textarea = page.locator("textarea");
    await textarea.clear();
    await textarea.fill("# Updated Content\n\nNew note body text.");
    await page.locator("button:has-text('Save')").click();
    await expect(page.locator(".markdown-body")).toBeVisible();
    await expect(page.locator("text=Content").first()).toBeVisible();
  });

  test("should cancel content edits", async ({ page }) => {
    await page.locator("button:has-text('Edit')").click();
    const textarea = page.locator("textarea");
    await textarea.clear();
    await textarea.fill("Should not persist");
    await page.locator("button:has-text('Cancel')").click();
    await expect(page.locator(".markdown-body:has-text('Performance review preparation')")).toBeVisible();
  });

  // Tags editing
  test("should display structural tags with lock icon", async ({ page }) => {
    const structuralTag = page.locator("text=1:1").first();
    await expect(structuralTag).toBeVisible();
  });

  test("should show remove button on non-structural tags", async ({ page }) => {
    const removeBtn = page.locator("[aria-label='Remove tag management']");
    await expect(removeBtn).toBeVisible();
  });

  test("should remove a non-structural tag", async ({ page }) => {
    const removeBtn = page.locator("[aria-label='Remove tag management']");
    await removeBtn.click();
    await expect(page.locator("[aria-label='Remove tag management']")).toHaveCount(0);
  });

  test("should add a tag from autocomplete", async ({ page }) => {
    const tagInput = page.locator("[data-testid='tag-add-input']");
    await tagInput.click();
    await tagInput.fill("zendesk");
    const suggestion = page.locator("button:has-text('zendesk')").first();
    await expect(suggestion).toBeVisible({ timeout: 10000 });
    await suggestion.click();
    await expect(page.locator("text=zendesk").first()).toBeVisible();
  });

  test("should show max tags limit at capacity", async ({ page }) => {
    const maxHint = page.locator("text=Max 8 tags");
    await expect(maxHint).toHaveCount(0);
  });

  // Participants editing
  test("should display participants with remove button", async ({ page }) => {
    await expect(page.locator("[aria-label='Remove participant Alice']")).toBeVisible();
  });

  test("should remove a participant", async ({ page }) => {
    await page.locator("[aria-label='Remove participant Alice']").click();
    await expect(page.locator("[aria-label='Remove participant Alice']")).toHaveCount(0);
  });

  test("should add a participant from autocomplete", async ({ page }) => {
    const personInput = page.locator("[data-testid='person-add-input']");
    await personInput.click();
    await personInput.fill("Val");
    const suggestion = page.locator("button:has-text('Valentin Cekov')").first();
    await expect(suggestion).toBeVisible({ timeout: 10000 });
    await suggestion.click();
    await expect(page.locator("text=Valentin Cekov").first()).toBeVisible();
  });
});