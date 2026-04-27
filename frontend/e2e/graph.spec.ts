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

  test("should have tag filter dropdown", async ({ page }) => {
    await expect(page.locator("text=Tag:").first()).toBeVisible();
    await expect(page.locator("select")).toBeVisible();
  });

  test("should have similarity threshold slider", async ({ page }) => {
    await expect(page.locator("text=Similarity:").first()).toBeVisible();
    await expect(page.locator('input[type="range"]')).toBeVisible();
  });

  test("should display graph container", async ({ page }) => {
    await page.waitForTimeout(1000); // Wait for 3D force-graph to initialize
    // The graph renders into a canvas element
    const container = page.locator('[data-testid="graph-container"] canvas');
    await expect(container).toBeVisible();
  });

  test("should display legend", async ({ page }) => {
    // Wait for graph data to load
    await page.waitForSelector('[data-testid="graph-stats"]');

    // Legend should be visible
    const legend = page.locator('[data-testid="graph-legend"]');
    await expect(legend).toBeVisible();

    // Legend shows primary tag names from mock data - scope to legend only
    await expect(legend.locator("text=1:1")).toBeVisible();
    await expect(legend.locator("text=work")).toBeVisible();
  });

  test("should display node/edge count", async ({ page }) => {
    await page.waitForSelector('[data-testid="graph-stats"]');
    await expect(page.locator('[data-testid="graph-stats"]')).toContainText("nodes");
    await expect(page.locator('[data-testid="graph-stats"]')).toContainText("edges");
  });

  test("should filter graph by tag", async ({ page }) => {
    await page.locator("select").first().selectOption("work");
    await page.waitForTimeout(500);

    await expect(page.getByRole('heading', { name: 'Similarity Graph' })).toBeVisible();
  });

  test("should adjust similarity threshold", async ({ page }) => {
    const slider = page.locator('input[type="range"]');
    await slider.fill("0.5");
    await page.waitForTimeout(500);

    await expect(page.getByRole('heading', { name: 'Similarity Graph' })).toBeVisible();
  });

  test("should not show details pane initially", async ({ page }) => {
    const pane = page.locator('[data-testid="graph-details-pane"]');
    await expect(pane).toHaveCSS('opacity', '0');
  });
});
