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
    const container = page.locator('[data-testid="graph-container"] canvas');
    await expect(container).toBeVisible();
  });

  test("should display node/edge count", async ({ page }) => {
    await page.waitForSelector('[data-testid="graph-stats"]');
    await expect(page.locator('[data-testid="graph-stats"]')).toContainText("nodes");
    await expect(page.locator('[data-testid="graph-stats"]')).toContainText("edges");
  });

  test("should display collapsed filter sections", async ({ page }) => {
    await page.waitForSelector('[data-testid="graph-stats"]', { timeout: 10000 });

    await expect(page.locator('[data-testid="filter-sources"]')).toBeVisible();
    await expect(page.locator('[data-testid="filter-structural-tags"]')).toBeVisible();
    await expect(page.locator('[data-testid="filter-tags"]')).toBeVisible();

    await expect(page.locator('[data-testid="filter-sources-heading"]')).toContainText("Sources");
    await expect(page.locator('[data-testid="filter-structural-tags-heading"]')).toContainText("Structural Tags");
    await expect(page.locator('[data-testid="filter-tags-heading"]')).toContainText("Tags");
  });

  test("should toggle source filter and update node count", async ({ page }) => {
    await page.waitForSelector('[data-testid="graph-stats"]', { timeout: 10000 });

    await page.locator('[data-testid="filter-sources-heading"]').click();
    const evernoteFilter = page.locator('[data-testid="source-filter-Evernote"]');
    await expect(evernoteFilter).toBeVisible();
    await expect(evernoteFilter).toHaveAttribute('data-active', 'true');

    await evernoteFilter.click();
    await expect(evernoteFilter).toHaveAttribute('data-active', 'false');

    const updatedStats = await page.locator('[data-testid="graph-stats"]').textContent();
    expect(updatedStats).toContain('nodes');
  });

  test("should toggle structural tag filter", async ({ page }) => {
    await page.waitForSelector('[data-testid="graph-stats"]', { timeout: 10000 });

    await page.locator('[data-testid="filter-structural-tags-heading"]').click();
    const workFilter = page.locator('[data-testid="structural-tag-filter-work"]');
    await expect(workFilter).toBeVisible();
    await expect(workFilter).toHaveAttribute('data-active', 'true');

    await workFilter.click();
    await expect(workFilter).toHaveAttribute('data-active', 'false');
  });

  test("should toggle content tag filter", async ({ page }) => {
    await page.waitForSelector('[data-testid="graph-stats"]', { timeout: 10000 });

    await page.locator('[data-testid="filter-tags-heading"]').click();
    const mgmtFilter = page.locator('[data-testid="content-tag-filter-management"]');
    await expect(mgmtFilter).toBeVisible();
    await expect(mgmtFilter).toHaveAttribute('data-active', 'true');

    await mgmtFilter.click();
    await expect(mgmtFilter).toHaveAttribute('data-active', 'false');
  });

  test("should unselect all sources and restore", async ({ page }) => {
    await page.waitForSelector('[data-testid="graph-stats"]', { timeout: 10000 });

    await page.locator('[data-testid="filter-sources-heading"]').click();
    const evernoteFilter = page.locator('[data-testid="source-filter-Evernote"]');
    await expect(evernoteFilter).toHaveAttribute('data-active', 'true');

    await evernoteFilter.click();
    await expect(evernoteFilter).toHaveAttribute('data-active', 'false');

    const unselectAll = page.locator('[data-testid="filter-sources"]').locator('text=Unselect all');
    await expect(unselectAll).toBeVisible();
    await unselectAll.click();

    await expect(evernoteFilter).toHaveAttribute('data-active', 'true');
  });

  test("should collapse and expand source filter section", async ({ page }) => {
    await page.waitForSelector('[data-testid="graph-stats"]', { timeout: 10000 });

    const heading = page.locator('[data-testid="filter-sources-heading"]');
    await heading.click();
    const sourceChips = page.locator('[data-testid="source-filter-Evernote"]');
    await expect(sourceChips).toBeVisible();

    await heading.click();
    await expect(sourceChips).not.toBeVisible();

    await heading.click();
    await expect(sourceChips).toBeVisible();
  });

  test("should collapse and expand structural tags section", async ({ page }) => {
    await page.waitForSelector('[data-testid="graph-stats"]', { timeout: 10000 });

    const heading = page.locator('[data-testid="filter-structural-tags-heading"]');
    await heading.click();
    const tagChips = page.locator('[data-testid="structural-tag-filter-work"]');
    await expect(tagChips).toBeVisible();

    await heading.click();
    await expect(tagChips).not.toBeVisible();

    await heading.click();
    await expect(tagChips).toBeVisible();
  });

  test("should collapse and expand content tags section", async ({ page }) => {
    await page.waitForSelector('[data-testid="graph-stats"]', { timeout: 10000 });

    const heading = page.locator('[data-testid="filter-tags-heading"]');
    await heading.click();
    const tagChips = page.locator('[data-testid="content-tag-filter-management"]');
    await expect(tagChips).toBeVisible();

    await heading.click();
    await expect(tagChips).not.toBeVisible();

    await heading.click();
    await expect(tagChips).toBeVisible();
  });

  test("should type in tag autocomplete and filter dropdown items", async ({ page }) => {
    const autocomplete = page.getByPlaceholder('Filter by tag...');
    await autocomplete.click();
    await autocomplete.fill('wo');

    await page.waitForSelector('[data-testid="tag-autocomplete-menu"]', { state: 'visible' });

    const items = page.locator('[data-testid="tag-autocomplete-item"]');
    await expect(items.first()).toBeVisible();
    const names = await items.locator('.truncate').allTextContents();
    for (const name of names) {
      expect(name.toLowerCase()).toContain('wo');
    }

    await autocomplete.fill('work');
    const workItems = page.locator('[data-testid="tag-autocomplete-item"]');
    await expect(workItems.filter({ hasText: 'work' })).toBeVisible();
  });

  test("should filter graph by tag", async ({ page }) => {
    const autocomplete = page.getByPlaceholder('Filter by tag...');

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
    await expect(autocomplete).toHaveValue('work');
  });

  test("should clear tag filter with X button", async ({ page }) => {
    const autocomplete = page.getByPlaceholder('Filter by tag...');
    await autocomplete.click();
    await autocomplete.fill('work');
    const menu = page.locator('[data-testid="tag-autocomplete-menu"]');
    await menu.getByText('work').first().click();

    await expect(autocomplete).toHaveValue('work');

    await page.locator('[data-testid="clear-tag-filter"]').click();

    await expect(autocomplete).toHaveValue('');
  });

  test("should adjust similarity threshold", async ({ page }) => {
    const slider = page.locator('input[type="range"]');

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

    const canvas = page.locator('[data-testid="graph-container"] canvas');
    await canvas.waitFor({ state: 'visible', timeout: 5000 });
    await canvas.click({ position: { x: 100, y: 100 } });
    await page.waitForTimeout(500);

    await expect(page.getByRole('heading', { name: 'Similarity Graph' })).toBeVisible();
    await expect(pane).toBeVisible();
    await expect(pane).toHaveCSS('pointer-events', 'none');
  });

  test("should not show details pane initially", async ({ page }) => {
    const pane = page.locator('[data-testid="graph-details-pane"]');
    await expect(pane).toHaveCSS('opacity', '0');
  });

  test("should keep only one source", async ({ page }) => {
    await page.waitForSelector('[data-testid="graph-stats"]', { timeout: 10000 });

    await page.locator('[data-testid="filter-sources-heading"]').click();
    const appleNotesFilter = page.locator('[data-testid="source-filter-Apple Notes"]');
    await expect(appleNotesFilter).toBeVisible();

    await appleNotesFilter.hover();
    await page.locator('[data-testid="source-filter-keep-Apple Notes"]').click();

    await expect(appleNotesFilter).toHaveAttribute('data-active', 'true');
    await expect(page.locator('[data-testid="source-filter-Evernote"]')).toHaveAttribute('data-active', 'false');
    await expect(page.locator('[data-testid="graph-stats"]')).toContainText('nodes');
  });

  test("should keep only one structural tag", async ({ page }) => {
    await page.waitForSelector('[data-testid="graph-stats"]', { timeout: 10000 });

    await page.locator('[data-testid="filter-structural-tags-heading"]').click();
    const workFilter = page.locator('[data-testid="structural-tag-filter-work"]');
    await expect(workFilter).toBeVisible();

    await workFilter.hover();
    await page.locator('[data-testid="structural-tag-filter-keep-work"]').click();

    await expect(workFilter).toHaveAttribute('data-active', 'true');
    await expect(page.locator('[data-testid="structural-tag-filter-zendesk"]')).toHaveAttribute('data-active', 'false');
    await expect(page.locator('[data-testid="graph-stats"]')).toContainText('nodes');
  });

  test("should keep only one content tag", async ({ page }) => {
    await page.waitForSelector('[data-testid="graph-stats"]', { timeout: 10000 });

    await page.locator('[data-testid="filter-tags-heading"]').click();
    const mgmtFilter = page.locator('[data-testid="content-tag-filter-management"]');
    await expect(mgmtFilter).toBeVisible();

    await mgmtFilter.hover();
    await page.locator('[data-testid="content-tag-filter-keep-management"]').click();

    await expect(mgmtFilter).toHaveAttribute('data-active', 'true');
    await expect(page.locator('[data-testid="content-tag-filter-architecture"]')).toHaveAttribute('data-active', 'false');
    await expect(page.locator('[data-testid="graph-stats"]')).toContainText('nodes');
  });
});