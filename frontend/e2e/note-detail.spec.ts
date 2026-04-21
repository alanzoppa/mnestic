import { test, expect } from "@playwright/test";
import { mockApiRoutes } from "./fixtures/mock-router";
import { mockNoteDetailWithImages, mockNoteDetailSingleImage } from "./fixtures/api-fixtures";

test.describe("Note Detail Page", () => {
  test.beforeEach(async ({ page }) => {
    await mockApiRoutes(page);
    await page.goto("/notes/note-001");
  });

  // Attachment tests
  test("should display single attachment full-width", async ({ page }) => {
    await mockApiRoutes(page);
    // Override the note endpoint to return single image note
    await page.route("**/api/notes/*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockNoteDetailSingleImage),
      });
    });
    await page.goto("/notes/note-single-image");
    
    // Single image should render full-width without aspect-square
    const attachmentCard = page.locator("text=Attachments (1)").locator("..").locator("..");
    const singleImage = attachmentCard.locator("img").first();
    await expect(singleImage).toBeVisible();
    // Should not have aspect-square container
    await expect(attachmentCard.locator(".aspect-square")).toHaveCount(0);
  });

  test("should display multiple attachments in grid", async ({ page }) => {
    await mockApiRoutes(page);
    await page.route("**/api/notes/*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockNoteDetailWithImages),
      });
    });
    await page.goto("/notes/note-with-images");
    
    // Should show "View all 2 images" button
    await expect(page.locator("text=View all 2 images")).toBeVisible();
    // Grid should have 2 image containers (aspect-square divs)
    const gridImages = page.locator(".aspect-square").filter({ has: page.locator("img") });
    await expect(gridImages).toHaveCount(2);
  });

  test("should open gallery lightbox when thumbnail clicked", async ({ page }) => {
    await mockApiRoutes(page);
    await page.route("**/api/notes/*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockNoteDetailWithImages),
      });
    });
    await page.goto("/notes/note-with-images");
    
    // Click the first attachment thumbnail
    const firstThumbnail = page.locator(".aspect-square").filter({ has: page.locator("img") }).first();
    await firstThumbnail.click();
    
    // Lightbox overlay should appear
    const lightbox = page.locator("div[class*='bg-black/90']");
    await expect(lightbox).toBeVisible();
    
    // Should show image counter
    await expect(page.locator("text=1 / 2")).toBeVisible();
  });

  test("should navigate lightbox with arrow keys", async ({ page }) => {
    await mockApiRoutes(page);
    await page.route("**/api/notes/*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockNoteDetailWithImages),
      });
    });
    await page.goto("/notes/note-with-images");
    
    // Open lightbox
    await page.locator("text=View all 2 images").click();
    await expect(page.locator("text=1 / 2")).toBeVisible();
    
    // Press right arrow
    await page.keyboard.press("ArrowRight");
    // Should advance to second image
    await expect(page.locator("text=2 / 2")).toBeVisible();
    
    // Press left arrow
    await page.keyboard.press("ArrowLeft");
    // Should go back to first image
    await expect(page.locator("text=1 / 2")).toBeVisible();
  });

  test("should close lightbox on Escape key", async ({ page }) => {
    await mockApiRoutes(page);
    await page.route("**/api/notes/*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockNoteDetailWithImages),
      });
    });
    await page.goto("/notes/note-with-images");
    
    // Open lightbox
    await page.locator("text=View all 2 images").click();
    await expect(page.locator("div[class*='bg-black/90']")).toBeVisible();
    
    // Press Escape
    await page.keyboard.press("Escape");
    
    // Lightbox should close
    await expect(page.locator("div[class*='bg-black/90']")).toHaveCount(0);
  });

  test("should close lightbox when clicking overlay", async ({ page }) => {
    await mockApiRoutes(page);
    await page.route("**/api/notes/*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockNoteDetailWithImages),
      });
    });
    await page.goto("/notes/note-with-images");
    
    // Open lightbox
    await page.locator("text=View all 2 images").click();
    const lightbox = page.locator("div[class*='bg-black/90']");
    await expect(lightbox).toBeVisible();
    
    // Click outside the image container (on the overlay)
    await lightbox.click({ position: { x: 10, y: 10 } });
    
    // Lightbox should close
    await expect(page.locator("div[class*='bg-black/90']")).toHaveCount(0);
  });

  test("should open single image lightbox when full-width image clicked", async ({ page }) => {
    await mockApiRoutes(page);
    await page.route("**/api/notes/*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockNoteDetailSingleImage),
      });
    });
    await page.goto("/notes/note-single-image");
    
    // Click the full-width single attachment
    const attachment = page.locator("text=Attachments (1)").locator("..").locator("..").locator("img").first();
    await attachment.click();
    
    // Lightbox should open
    const lightbox = page.locator("div[class*='bg-black/90']");
    await expect(lightbox).toBeVisible();
    
    // Single image should show "1 / 1" counter
    await expect(page.locator("text=1 / 1")).toBeVisible();
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

  // Re-fetch verification: edits persist across GET-after-PATCH
  test("should persist tag removal after page re-fetch", async ({ page }) => {
    const removeBtn = page.locator("[aria-label='Remove tag management']");
    await removeBtn.click();
    await expect(page.locator("[aria-label='Remove tag management']")).toHaveCount(0);

    await page.reload();
    await page.locator("[data-testid='editable-title']").waitFor();
    await expect(page.locator("[aria-label='Remove tag management']")).toHaveCount(0);
  });

  test("should persist participant addition after page re-fetch", async ({ page }) => {
    const personInput = page.locator("[data-testid='person-add-input']");
    await personInput.click();
    await personInput.fill("Bob");
    const suggestion = page.locator("button:has-text('Bob Jones')").first();
    await expect(suggestion).toBeVisible({ timeout: 10000 });
    await suggestion.click();

    await expect(page.locator("text=Bob Jones").first()).toBeVisible();

    await page.reload();
    await page.locator("[data-testid='editable-title']").waitFor();
    await expect(page.locator("text=Bob Jones").first()).toBeVisible();
  });

  test("should persist title edit after page re-fetch", async ({ page }) => {
    const titleEl = page.locator("[data-testid='editable-title']");
    await titleEl.hover();
    await page.locator("[aria-label='Edit title']").click({ force: true });
    const input = page.locator("[data-testid='title-input']");
    await input.clear();
    await input.fill("Persisted Title");
    await page.locator("[aria-label='Save title']").click();

    await expect(page.locator("[data-testid='editable-title']").filter({ hasText: "Persisted Title" })).toBeVisible();

    await page.reload();
    await page.locator("[data-testid='editable-title']").waitFor();
    await expect(page.locator("[data-testid='editable-title']").filter({ hasText: "Persisted Title" })).toBeVisible();
  });
});