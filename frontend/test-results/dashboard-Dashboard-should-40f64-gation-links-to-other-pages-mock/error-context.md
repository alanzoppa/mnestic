# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: dashboard.spec.ts >> Dashboard >> should have navigation links to other pages
- Location: e2e/dashboard.spec.ts:64:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('main').locator('a:has-text("Advanced Search")')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for locator('main').locator('a:has-text("Advanced Search")')

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
  4  | test.describe("Dashboard", () => {
  5  |   test.beforeEach(async ({ page }) => {
  6  |     await mockApiRoutes(page);
  7  |     await page.goto("/");
  8  |   });
  9  | 
  10 |   test("should display app title and stats", async ({ page }) => {
  11 |     // Main page heading should be Notes Browser
  12 |     const mainContent = page.locator("main");
  13 |     await expect(mainContent.getByRole('heading', { name: 'Notes Browser' })).toBeVisible();
  14 | 
  15 |     // Stats should be visible
  16 |     await expect(mainContent.locator("text=Total Notes")).toBeVisible();
  17 |     await expect(mainContent.locator("text=1,641")).toBeVisible();
  18 |     await expect(mainContent.locator("text=Tags")).toBeVisible();
  19 |     await expect(mainContent.locator("text=Calendar Events")).toBeVisible();
  20 |     await expect(mainContent.locator("text=Date Range")).toBeVisible();
  21 |   });
  22 | 
  23 |   test("should have search functionality", async ({ page }) => {
  24 |     const mainContent = page.locator("main");
  25 |     const searchInput = mainContent.locator('input[placeholder="Search notes..."]');
  26 |     await expect(searchInput).toBeVisible();
  27 | 
  28 |     await searchInput.fill("management");
  29 |     await searchInput.press("Enter");
  30 | 
  31 |     await expect(mainContent.locator("text=Results")).toBeVisible();
  32 |   });
  33 | 
  34 |   test("should display search results from dashboard search", async ({ page }) => {
  35 |     const mainContent = page.locator("main");
  36 |     const searchInput = mainContent.locator('input[placeholder="Search notes..."]');
  37 |     await searchInput.fill("management");
  38 |     await mainContent.locator('button:has-text("Search")').click();
  39 | 
  40 |     await expect(mainContent.locator("text=1:1 with Alice")).toBeVisible();
  41 |     await expect(mainContent.locator("text=Zendesk Chat Architecture")).toBeVisible();
  42 |   });
  43 | 
  44 |   test("should have ingest management buttons", async ({ page }) => {
  45 |     const mainContent = page.locator("main");
  46 |     await expect(mainContent.locator("text=Index Management")).toBeVisible();
  47 | 
  48 |     const incrementalBtn = mainContent.locator('button:has-text("Incremental Ingest")');
  49 |     const fullBtn = mainContent.locator('button:has-text("Full Re-ingest")');
  50 | 
  51 |     await expect(incrementalBtn).toBeVisible();
  52 |     await expect(fullBtn).toBeVisible();
  53 |   });
  54 | 
  55 |   test("should trigger incremental ingest and show result", async ({ page }) => {
  56 |     const mainContent = page.locator("main");
  57 |     const incrementalBtn = mainContent.locator('button:has-text("Incremental Ingest")');
  58 |     await incrementalBtn.click();
  59 | 
  60 |     await expect(mainContent.locator("text=Ingesting...")).toBeVisible();
  61 |     await expect(mainContent.locator("text=Notes:")).toBeVisible({ timeout: 5000 });
  62 |   });
  63 | 
  64 |   test("should have navigation links to other pages", async ({ page }) => {
  65 |     const mainContent = page.locator("main");
> 66 |     await expect(mainContent.locator('a:has-text("Advanced Search")')).toBeVisible();
     |                                                                        ^ Error: expect(locator).toBeVisible() failed
  67 |     await expect(mainContent.locator('a:has-text("Browse All")')).toBeVisible();
  68 |   });
  69 | 
  70 |   test("should navigate to search page via Advanced Search link", async ({ page }) => {
  71 |     await page.locator('a:has-text("Advanced Search")').click();
  72 |     await expect(page).toHaveURL(/\/search/);
  73 |     await expect(page.getByRole('heading', { name: 'Search Notes' })).toBeVisible();
  74 |   });
  75 | 
  76 |   test("should navigate to browse page via Browse All link", async ({ page }) => {
  77 |     await page.locator('a:has-text("Browse All")').click();
  78 |     await expect(page).toHaveURL(/\/browse/);
  79 |     await expect(page.getByRole('heading', { name: 'Browse Notes' })).toBeVisible();
  80 |   });
  81 | });
  82 | 
```