# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: nav.spec.ts >> Navigation >> should navigate to Search page
- Location: e2e/nav.spec.ts:36:7

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('nav a:has-text(\'Search\')')

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
  4  | test.describe("Navigation", () => {
  5  |   test.beforeEach(async ({ page }) => {
  6  |     await mockApiRoutes(page);
  7  |   });
  8  | 
  9  |   test("should display all nav links", async ({ page }) => {
  10 |     await page.goto("/");
  11 | 
  12 |     const nav = page.locator("nav");
  13 |     await expect(nav).toBeVisible();
  14 |     await expect(nav.locator("a:has-text('Dashboard')")).toBeVisible();
  15 |     await expect(nav.locator("a:has-text('Search')")).toBeVisible();
  16 |     await expect(nav.locator("a:has-text('Browse')")).toBeVisible();
  17 |     await expect(nav.locator("a:has-text('Tags')")).toBeVisible();
  18 |     await expect(nav.locator("a:has-text('Timeline')")).toBeVisible();
  19 |     await expect(nav.locator("a:has-text('Calendar')")).toBeVisible();
  20 |     await expect(nav.locator("a:has-text('Graph')")).toBeVisible();
  21 |   });
  22 | 
  23 |   test("should highlight active page in nav", async ({ page }) => {
  24 |     const nav = page.locator("nav");
  25 |     
  26 |     await page.goto("/");
  27 |     await expect(nav.locator("a:has-text('Dashboard')")).toHaveClass(/bg-zinc-700/);
  28 | 
  29 |     await page.goto("/search");
  30 |     await expect(nav.locator("a:has-text('Search')")).toHaveClass(/bg-zinc-700/);
  31 | 
  32 |     await page.goto("/browse");
  33 |     await expect(nav.locator("a:has-text('Browse')")).toHaveClass(/bg-zinc-700/);
  34 |   });
  35 | 
  36 |   test("should navigate to Search page", async ({ page }) => {
  37 |     await page.goto("/");
> 38 |     await page.locator("nav a:has-text('Search')").click();
     |                                                    ^ Error: locator.click: Test timeout of 30000ms exceeded.
  39 |     await expect(page).toHaveURL(/\/search/);
  40 |     await expect(page.getByRole('heading', { name: 'Search Notes' })).toBeVisible();
  41 |   });
  42 | 
  43 |   test("should navigate to Browse page", async ({ page }) => {
  44 |     await page.goto("/");
  45 |     await page.locator("nav a:has-text('Browse')").click();
  46 |     await expect(page).toHaveURL(/\/browse/);
  47 |     await expect(page.getByRole('heading', { name: 'Browse Notes' })).toBeVisible();
  48 |   });
  49 | 
  50 |   test("should navigate to Tags page", async ({ page }) => {
  51 |     await page.goto("/");
  52 |     await page.locator("nav a:has-text('Tags')").click();
  53 |     await expect(page).toHaveURL(/\/tags$/);
  54 |     await expect(page.getByRole('heading', { name: 'Tag Explorer' })).toBeVisible();
  55 |   });
  56 | 
  57 |   test("should navigate to Timeline page", async ({ page }) => {
  58 |     await page.goto("/");
  59 |     await page.locator("nav a:has-text('Timeline')").click();
  60 |     await expect(page).toHaveURL(/\/timeline/);
  61 |     await expect(page.getByRole('heading', { name: 'Timeline' })).toBeVisible();
  62 |   });
  63 | 
  64 |   test("should navigate to Calendar page", async ({ page }) => {
  65 |     await page.goto("/");
  66 |     await page.locator("nav a:has-text('Calendar')").click();
  67 |     await expect(page).toHaveURL(/\/calendar/);
  68 |     await expect(page.getByRole('heading', { name: 'Calendar' })).toBeVisible();
  69 |   });
  70 | 
  71 |   test("should navigate to Graph page", async ({ page }) => {
  72 |     await page.goto("/");
  73 |     await page.locator("nav a:has-text('Graph')").click();
  74 |     await expect(page).toHaveURL(/\/graph/);
  75 |     await expect(page.getByRole('heading', { name: 'Similarity Graph' })).toBeVisible();
  76 |   });
  77 | 
  78 |   test("should persist across page navigations", async ({ page }) => {
  79 |     await page.goto("/");
  80 | 
  81 |     await page.locator("nav a:has-text('Tags')").click();
  82 |     await expect(page.getByRole('heading', { name: 'Tag Explorer' })).toBeVisible();
  83 | 
  84 |     await page.locator("nav a:has-text('Calendar')").click();
  85 |     await expect(page.getByRole('heading', { name: 'Calendar' })).toBeVisible();
  86 | 
  87 |     await page.locator("nav a:has-text('Dashboard')").click();
  88 |     await expect(page.getByRole('heading', { name: 'Notes Browser' })).toBeVisible();
  89 |   });
  90 | });
  91 | 
```