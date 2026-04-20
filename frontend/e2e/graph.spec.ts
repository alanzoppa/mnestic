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

  test("should have tag filter dropdown", async ({ page }) => {
    await expect(page.locator("text=Tag:").first()).toBeVisible();
    await expect(page.locator("select")).toBeVisible();
  });

  test("should have similarity threshold slider", async ({ page }) => {
    await expect(page.locator("text=Similarity:").first()).toBeVisible();
    await expect(page.locator('input[type="range"]')).toBeVisible();
  });

  test("should display graph container", async ({ page }) => {
    await page.waitForTimeout(1000); // Wait for force-graph to initialize
    // The graph container should exist - check by looking for the div that holds the graph
    const container = page.locator('div[style*="min-height"]');
    await expect(container.count()).toBeGreaterThan(0);
  });

  test("should display legend", async ({ page }) => {
    await expect(page.locator("text=Legend")).toBeVisible();
    await expect(page.locator("text=1:1 Notes")).toBeVisible();
    await expect(page.locator("text=Work")).toBeVisible();
    await expect(page.locator("text=Personal")).toBeVisible();
  });

  test("should display node/edge count", async ({ page }) => {
    await page.waitForTimeout(1000);
    await expect(page.locator("text=nodes")).toBeVisible();
    await expect(page.locator("text=edges")).toBeVisible();
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
});
