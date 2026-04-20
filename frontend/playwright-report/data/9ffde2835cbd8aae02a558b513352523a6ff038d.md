# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: browse.spec.ts >> Browse Page >> should display browse page title
- Location: e2e/browse.spec.ts:10:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('main').getByRole('heading', { name: 'Browse Notes' })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for locator('main').getByRole('heading', { name: 'Browse Notes' })

```

# Page snapshot

```yaml
- generic:
  - generic [active]:
    - generic [ref=e3]:
      - generic [ref=e4]:
        - generic [ref=e5]:
          - navigation [ref=e6]:
            - button "previous" [disabled] [ref=e7]:
              - img "previous" [ref=e8]
            - generic [ref=e10]:
              - generic [ref=e11]: 1/
              - text: "1"
            - button "next" [disabled] [ref=e12]:
              - img "next" [ref=e13]
          - img
        - generic [ref=e15]:
          - generic [ref=e16]:
            - img [ref=e17]
            - generic "Latest available version is detected (16.2.4)." [ref=e19]: Next.js 16.2.4
            - generic [ref=e20]: Turbopack
          - img
      - dialog "Build Error" [ref=e22]:
        - generic [ref=e25]:
          - generic [ref=e26]:
            - generic [ref=e27]:
              - generic [ref=e29]: Build Error
              - generic [ref=e30]:
                - button "Copy Error Info" [ref=e31] [cursor=pointer]:
                  - img [ref=e32]
                - button "No related documentation found" [disabled] [ref=e34]:
                  - img [ref=e35]
                - button "Attach Node.js inspector" [ref=e37] [cursor=pointer]:
                  - img [ref=e38]
            - generic [ref=e47]: Error evaluating Node.js code
          - generic [ref=e49]:
            - generic [ref=e51]:
              - img [ref=e53]
              - generic [ref=e55]: ./src/app/globals.css
              - button "Open in editor" [ref=e56] [cursor=pointer]:
                - img [ref=e58]
            - generic [ref=e62]: "Error evaluating Node.js code CssSyntaxError: tailwindcss: /Users/alanzoppa/Codes/notes-browser/frontend/src/app/globals.css:1:1: Cannot apply unknown utility class `card` [at Input.error (turbopack:///[project]/node_modules/postcss/lib/input.js:135:16)] [at Root.error (turbopack:///[project]/node_modules/postcss/lib/node.js:146:32)] [at Object.Once (/Users/alanzoppa/Codes/notes-browser/frontend/node_modules/@tailwindcss/postcss/dist/index.js:10:6913)] [at async LazyResult.runAsync (turbopack:///[project]/node_modules/postcss/lib/lazy-result.js:293:11)] [at async transform (turbopack:///[turbopack-node]/transforms/postcss.ts:70:34)] [at async run (turbopack:///[turbopack-node]/child_process/evaluate.ts:89:23)] Import trace: Client Component Browser: ./src/app/globals.css [Client Component Browser] ./src/app/layout.tsx [Server Component]"
        - generic [ref=e63]: "1"
        - generic [ref=e64]: "2"
    - generic [ref=e69] [cursor=pointer]:
      - button "Open Next.js Dev Tools" [ref=e70]:
        - img [ref=e71]
      - button "Open issues overlay" [ref=e75]:
        - generic [ref=e76]:
          - generic [ref=e77]: "0"
          - generic [ref=e78]: "1"
        - generic [ref=e79]: Issue
  - alert [ref=e80]
```

# Test source

```ts
  1  | import { test, expect } from "@playwright/test";
  2  | import { mockApiRoutes } from "./fixtures/mock-router";
  3  | 
  4  | test.describe("Browse Page", () => {
  5  |   test.beforeEach(async ({ page }) => {
  6  |     await mockApiRoutes(page);
  7  |     await page.goto("/browse");
  8  |   });
  9  | 
  10 |   test("should display browse page title", async ({ page }) => {
  11 |     // Main heading in browse page
  12 |     const mainContent = page.locator("main");
> 13 |     await expect(mainContent.getByRole('heading', { name: 'Browse Notes' })).toBeVisible();
     |                                                                              ^ Error: expect(locator).toBeVisible() failed
  14 |   });
  15 | 
  16 |   test("should display filter controls", async ({ page }) => {
  17 |     await expect(page.locator('select:has-text("All Sources")')).toBeVisible();
  18 |     await expect(page.locator('input[placeholder="Filter by folder"]')).toBeVisible();
  19 |     // Look for note count in main content, not sidebar
  20 |     await expect(page.locator("span:has-text('3 notes')")).toBeVisible();
  21 |   });
  22 | 
  23 |   test("should display note list items", async ({ page }) => {
  24 |     // Look for h3 elements (note titles) in the main content
  25 |     await expect(page.locator("h3:has-text('1:1 with Alice - March 2024')")).toBeVisible();
  26 |     await expect(page.locator("h3:has-text('Zendesk Chat Architecture Review')")).toBeVisible();
  27 |     // Look for folder badges
  28 |     await expect(page.locator("span:has-text('1:1 Notes')").first()).toBeVisible();
  29 |   });
  30 | 
  31 |   test("should show tags on note cards", async ({ page }) => {
  32 |     // Look for tags specifically within the note cards (not in the nav)
  33 |     const tag1 = page.locator('span:has-text("1:1").bg-zinc-800').first();
  34 |     await expect(tag1).toBeVisible();
  35 |     await expect(page.locator("span:has-text('zendesk')")).toBeVisible();
  36 |   });
  37 | 
  38 |   test("should navigate to note detail on click", async ({ page }) => {
  39 |     await page.locator("h3:has-text('1:1 with Alice - March 2024')").click();
  40 |     await expect(page).toHaveURL(/\/notes\/note-001/);
  41 |     await expect(page.getByRole('heading', { name: /1:1 with Alice - March 2024/ })).toBeVisible();
  42 |   });
  43 | 
  44 |   test("should filter by source", async ({ page }) => {
  45 |     await page.locator('select').selectOption("Evernote");
  46 |     await page.waitForTimeout(100);
  47 | 
  48 |     // Should only show Evernote results
  49 |     await expect(page.locator("h3:has-text('Zendesk Chat Architecture Review')")).toBeVisible();
  50 |     await expect(page.locator("span:has-text('Evernote')").first()).toBeVisible();
  51 |   });
  52 | 
  53 |   test("should have pagination controls when results exist", async ({ page }) => {
  54 |     await page.goto("/browse");
  55 | 
  56 |     // If there are many notes, pagination should appear
  57 |     const paginationExists = await page.locator('button:has-text("Previous")').count() > 0 ||
  58 |                                await page.locator('button:has-text("Next")').count() > 0;
  59 | 
  60 |     // This test may pass with or without pagination depending on data
  61 |     expect(paginationExists || true).toBe(true);
  62 |   });
  63 | });
  64 | 
```