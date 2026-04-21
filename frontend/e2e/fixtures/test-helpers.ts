import { Page } from "@playwright/test";
import { mockApiRoutes, MockOptions } from "./mock-router";

export interface SetupOptions extends MockOptions {
  waitForSelector?: string;
  timeout?: number;
}

/**
 * Setup a test page with mock API routes and wait for page to load
 * 
 * Note: We don't use waitForResponse or networkidle because of timing issues 
 * with parallel tests and Next.js compilation. Instead, we wait for specific selectors.
 */
export async function setupTest(
  page: Page,
  url: string,
  _apiPattern: string,  // Kept for API compatibility but not used
  options?: SetupOptions
) {
  // Setup mock routes
  await mockApiRoutes(page, options);

  // Navigate to page with a shorter load timeout
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 });

  // Wait for the specific selector if provided, with a longer timeout
  if (options?.waitForSelector) {
    await page.waitForSelector(options.waitForSelector, {
      state: "visible",
      timeout: options.timeout ?? 15000,
    });
  }
}

/**
 * Setup test without waiting for specific API response
 * Use when the page makes multiple API calls
 */
export async function setupTestSimple(
  page: Page,
  url: string,
  options?: SetupOptions
) {
  await mockApiRoutes(page, options);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 });

  if (options?.waitForSelector) {
    await page.waitForSelector(options.waitForSelector, {
      state: "visible",
      timeout: options.timeout ?? 15000,
    });
  }
}
