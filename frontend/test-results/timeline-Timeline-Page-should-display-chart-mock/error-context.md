# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: timeline.spec.ts >> Timeline Page >> should display chart
- Location: e2e/timeline.spec.ts:14:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('.recharts-wrapper')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for locator('.recharts-wrapper')

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
  4  | test.describe("Timeline Page", () => {
  5  |   test.beforeEach(async ({ page }) => {
  6  |     await mockApiRoutes(page);
  7  |     await page.goto("/timeline");
  8  |   });
  9  | 
  10 |   test("should display page title", async ({ page }) => {
  11 |     await expect(page.getByRole('heading', { name: 'Timeline' })).toBeVisible();
  12 |   });
  13 | 
  14 |   test("should display chart", async ({ page }) => {
> 15 |     await expect(page.locator(".recharts-wrapper")).toBeVisible();
     |                                                     ^ Error: expect(locator).toBeVisible() failed
  16 |   });
  17 | 
  18 |   test("should have tag filter dropdown", async ({ page }) => {
  19 |     await expect(page.locator("select")).toBeVisible();
  20 |     // The dropdown may contain different options based on the hardcoded TAGS list
  21 |   });
  22 | 
  23 |   test("should display period count summary", async ({ page }) => {
  24 |     await expect(page.locator("text=notes across")).toBeVisible();
  25 |     await expect(page.locator("text=periods")).toBeVisible();
  26 |   });
  27 | 
  28 |   test("should filter by tag", async ({ page }) => {
  29 |     // Select the first available option (not "All tags")
  30 |     await page.locator("select").selectOption({ index: 1 });
  31 |     await page.waitForTimeout(100);
  32 | 
  33 |     // Chart should still be visible after filtering
  34 |     await expect(page.locator(".recharts-wrapper")).toBeVisible();
  35 |   });
  36 | });
  37 | 
```