# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: search.spec.ts >> Search Page >> should display search page title
- Location: e2e/search.spec.ts:10:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('heading', { name: 'Search Notes' })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByRole('heading', { name: 'Search Notes' })

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
  4  | test.describe("Search Page", () => {
  5  |   test.beforeEach(async ({ page }) => {
  6  |     await mockApiRoutes(page);
  7  |     await page.goto("/search");
  8  |   });
  9  | 
  10 |   test("should display search page title", async ({ page }) => {
> 11 |     await expect(page.getByRole('heading', { name: 'Search Notes' })).toBeVisible();
     |                                                                       ^ Error: expect(locator).toBeVisible() failed
  12 |   });
  13 | 
  14 |   test("should have search input with placeholder", async ({ page }) => {
  15 |     const searchInput = page.locator('input[placeholder="Search your notes..."]');
  16 |     await expect(searchInput).toBeVisible();
  17 |     await expect(searchInput).toHaveAttribute("placeholder", "Search your notes...");
  18 |   });
  19 | 
  20 |   test("should perform search and display results", async ({ page }) => {
  21 |     const searchInput = page.locator('input[placeholder="Search your notes..."]');
  22 |     await searchInput.fill("management");
  23 |     await page.locator('button:has-text("Search")').click();
  24 | 
  25 |     await expect(page.locator("h3:has-text('1:1 with Alice - March 2024')")).toBeVisible();
  26 |     await expect(page.locator("h3:has-text('Zendesk Chat Architecture Review')")).toBeVisible();
  27 |     await expect(page.locator("text=Score:").first()).toBeVisible();
  28 |   });
  29 | 
  30 |   test("should have filter controls", async ({ page }) => {
  31 |     // Source filter
  32 |     await expect(page.locator('select:has-text("All Sources")')).toBeVisible();
  33 | 
  34 |     // Folder filter
  35 |     await expect(page.locator('input[placeholder="Folder"]')).toBeVisible();
  36 | 
  37 |     // Tags filter
  38 |     await expect(page.locator('input[placeholder="Tags (comma sep)"]')).toBeVisible();
  39 | 
  40 |     // Date range filters
  41 |     await expect(page.locator('input[type="date"]')).toHaveCount(2);
  42 |   });
  43 | 
  44 |   test("should filter by source", async ({ page }) => {
  45 |     await page.locator('select').selectOption("Apple Notes");
  46 |     // After selecting, the filter should be applied
  47 |     await expect(page.locator('select').first()).toHaveValue("Apple Notes");
  48 |   });
  49 | 
  50 |   test("should navigate to note from search result", async ({ page }) => {
  51 |     await page.locator('input[placeholder="Search your notes..."]').fill("Alice");
  52 |     await page.locator('button:has-text("Search")').click();
  53 | 
  54 |     await page.locator("h3:has-text('1:1 with Alice - March 2024')").click();
  55 |     await expect(page).toHaveURL(/\/notes\/note-001/);
  56 |   });
  57 | 
  58 |   test("should show empty state when no results", async ({ page }) => {
  59 |     await page.route("**/api/search", async (route) => {
  60 |       await route.fulfill({
  61 |         status: 200,
  62 |         contentType: "application/json",
  63 |         body: JSON.stringify({ results: [] }),
  64 |       });
  65 |     });
  66 | 
  67 |     await page.locator('input[placeholder="Search your notes..."]').fill("xyznonexistent");
  68 |     await page.locator('button:has-text("Search")').click();
  69 | 
  70 |     await expect(page.locator("text=No results found")).toBeVisible();
  71 |   });
  72 | });
  73 | 
```