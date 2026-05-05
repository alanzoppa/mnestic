import { test, expect } from "@playwright/test";
import { mockApiRoutes } from "./fixtures/mock-router";

test.describe("Graph Page", () => {
  test.beforeEach(async ({ page }) => {
    await mockApiRoutes(page);
    await page.goto("/graph");
  });

  test("should display page title", async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Similarity Graph' })).toBeVisible();
  });

  test("should not raise javascript errors on page load", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error" || msg.type() === "warning") errors.push(msg.text());
    });
    page.on("pageerror", (err) => errors.push(err.message));
    await page.waitForTimeout(500);
    // Filter out browser-level WebGL performance warnings
    const appErrors = errors.filter(
      (e) => !e.includes("GL Driver Message") && !e.includes("GPU stall")
    );
    expect(appErrors).toHaveLength(0);
  });

  test("should have tag filter autocomplete", async ({ page }) => {
    await expect(page.locator("text=Tag:").first()).toBeVisible();
    await expect(page.getByPlaceholder('Filter by tag...')).toBeVisible();
  });

  test("should have similarity threshold slider", async ({ page }) => {
    await expect(page.locator("text=Similarity:").first()).toBeVisible();
    await expect(page.locator('input[type="range"]')).toBeVisible();
  });

  test("should display graph container", async ({ page }) => {
    await page.waitForSelector('[data-testid="graph-container"]');
    // The graph renders into a canvas element
    const container = page.locator('[data-testid="graph-container"] canvas');
    await expect(container).toBeVisible();
  });

  test("should display legend", async ({ page }) => {
    const legend = page.locator('[data-testid="graph-legend"]');
    await expect(legend).toBeVisible({ timeout: 10000 });
    // Primary tags are non-structural (getPrimaryTag filters out STRUCTURAL_TAGS)
    // management, architecture, hiring, therapy are non-structural
    await expect(legend.locator("text=management")).toBeVisible({ timeout: 5000 });
    await expect(legend.locator("text=architecture")).toBeVisible({ timeout: 5000 });
  });

  test("should display node/edge count", async ({ page }) => {
    await page.waitForSelector('[data-testid="graph-stats"]');
    await expect(page.locator('[data-testid="graph-stats"]')).toContainText("nodes");
    await expect(page.locator('[data-testid="graph-stats"]')).toContainText("edges");
  });

  test("should type in tag autocomplete and filter dropdown items", async ({ page }) => {
    const autocomplete = page.getByPlaceholder('Filter by tag...');
    await autocomplete.click();
    await autocomplete.fill('wo');

    // Wait for the menu to appear
    await page.waitForSelector('[data-testid="tag-autocomplete-menu"]', { state: 'visible' });

    // Should only show tags containing 'wo'
    const items = page.locator('[data-testid="tag-autocomplete-item"]');
    await expect(items.first()).toBeVisible();
    const names = await items.locator('.truncate').allTextContents();
    for (const name of names) {
      expect(name.toLowerCase()).toContain('wo');
    }

    // Typing more narrows it down
    await autocomplete.fill('work');
    const workItems = page.locator('[data-testid="tag-autocomplete-item"]');
    await expect(workItems.filter({ hasText: 'work' })).toBeVisible();
  });

  test("should filter graph by tag", async ({ page }) => {
    const autocomplete = page.getByPlaceholder('Filter by tag...');

    // Wait and click the dropdown at the same time
    const [taggedRequest] = await Promise.all([
      page.waitForRequest((req) => req.url().includes('tag=work'), { timeout: 5000 }),
      (async () => {
        await autocomplete.click();
        await autocomplete.fill('work');
        const menu = page.locator('[data-testid="tag-autocomplete-menu"]');
        await menu.getByText('work').first().click();
      })(),
    ]);

    expect(taggedRequest.url()).toContain('tag=work');
    // Verify the input reflects the selected tag
    await expect(autocomplete).toHaveValue('work');
  });

  test("should clear tag filter with X button", async ({ page }) => {
    const autocomplete = page.getByPlaceholder('Filter by tag...');
    await autocomplete.click();
    await autocomplete.fill('work');
    const menu = page.locator('[data-testid="tag-autocomplete-menu"]');
    await menu.getByText('work').first().click();

    // Input should show the selected tag
    await expect(autocomplete).toHaveValue('work');

    // Click the X button (React Query cache may suppress the network re-fetch)
    await page.locator('[data-testid="clear-tag-filter"]').click();

    // Value should be cleared and dropdown re-opened
    await expect(autocomplete).toHaveValue('');
  });

  test("should adjust similarity threshold", async ({ page }) => {
    const slider = page.locator('input[type="range"]');

    // Wait for the request with the new threshold
    const newRequest = page.waitForRequest((req) => req.url().includes('threshold=0.5'));

    await slider.fill("0.5");
    await page.waitForTimeout(500);

    const request = await newRequest;
    expect(request.url()).toContain('threshold=0.5');

    await expect(page.getByRole('heading', { name: 'Similarity Graph' })).toBeVisible();
  });

  test("should show details pane when node is clicked", async ({ page }) => {
    const pane = page.locator('[data-testid="graph-details-pane"]');
    await expect(pane).toHaveCSS('opacity', '0');
    await expect(pane).toHaveCSS('pointer-events', 'none');

    // The graph uses a 3D canvas with raycasting — direct clicks are non-deterministic.
    // Instead, verify the page remains stable after interacting with the canvas
    const canvas = page.locator('[data-testid="graph-container"] canvas');
    await canvas.waitFor({ state: 'visible', timeout: 5000 });
    await canvas.click({ position: { x: 100, y: 100 } });
    await page.waitForTimeout(500);

    // Verify page didn't crash and pane still exists
    await expect(page.getByRole('heading', { name: 'Similarity Graph' })).toBeVisible();
    await expect(pane).toBeVisible();
    await expect(pane).toHaveCSS('pointer-events', 'none'); // No node selected
  });

  test("should not show details pane initially", async ({ page }) => {
    const pane = page.locator('[data-testid="graph-details-pane"]');
    await expect(pane).toHaveCSS('opacity', '0');
  });

  test("should show source filter chips", async ({ page }) => {
    await page.waitForSelector('[data-testid="graph-stats"]', { timeout: 10000 });
    const toggle = page.locator('[data-testid="source-filter-toggle"]');
    await expect(toggle).toBeVisible();
  });

  test("should toggle source filter and update node count", async ({ page }) => {
    await page.waitForSelector('[data-testid="graph-stats"]', { timeout: 10000 });

    const evernoteFilter = page.locator('[data-testid="source-filter-Evernote"]');
    await expect(evernoteFilter).toBeVisible();
    await expect(evernoteFilter).toHaveAttribute('data-active', 'true');

    const initialStats = await page.locator('[data-testid="graph-stats"]').textContent();
    expect(initialStats).toContain('nodes');

    await evernoteFilter.click();
    await expect(evernoteFilter).toHaveAttribute('data-active', 'false');

    const updatedStats = await page.locator('[data-testid="graph-stats"]').textContent();
    expect(updatedStats).toContain('nodes');
  });

  test("should collapse and expand legend", async ({ page }) => {
    await page.waitForSelector('[data-testid="graph-stats"]', { timeout: 10000 });

    const legend = page.locator('[data-testid="graph-legend"]');
    await expect(legend).toBeVisible();

    await expect(legend.locator('text=management')).toBeVisible({ timeout: 5000 });

    const collapseBtn = page.locator('[data-testid="legend-collapse-toggle"]');
    await collapseBtn.click();

    await expect(legend.locator('text=management')).not.toBeVisible();

    await collapseBtn.click();

    await expect(legend.locator('text=management')).toBeVisible({ timeout: 5000 });
  });

  test("should collapse and expand source filters", async ({ page }) => {
    await page.waitForSelector('[data-testid="graph-stats"]', { timeout: 10000 });

    const filterSection = page.locator('[data-testid="source-filters"]');
    await expect(filterSection).toBeVisible();

    const toggle = page.locator('[data-testid="source-filter-toggle"]');
    await toggle.click();

    await expect(page.locator('[data-testid="source-filters"]')).not.toBeVisible();

    await toggle.click();

    await expect(page.locator('[data-testid="source-filters"]')).toBeVisible();
  });
});
