# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: note-detail.spec.ts >> Note Detail Page >> should display note metadata
- Location: e2e/note-detail.spec.ts:14:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('header span:has-text(\'1:1 Notes\')')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for locator('header span:has-text(\'1:1 Notes\')')

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
  4  | test.describe("Note Detail Page", () => {
  5  |   test.beforeEach(async ({ page }) => {
  6  |     await mockApiRoutes(page);
  7  |     await page.goto("/notes/note-001");
  8  |   });
  9  | 
  10 |   test("should display note title", async ({ page }) => {
  11 |     await expect(page.getByRole('heading', { name: '1:1 with Alice - March 2024' })).toBeVisible();
  12 |   });
  13 | 
  14 |   test("should display note metadata", async ({ page }) => {
  15 |     // Use more specific selectors to avoid matching sidebar nav
> 16 |     await expect(page.locator("header span:has-text('1:1 Notes')")).toBeVisible();
     |                                                                     ^ Error: expect(locator).toBeVisible() failed
  17 |     await expect(page.locator("header span:has-text('Apple Notes')")).toBeVisible();
  18 |     await expect(page.locator("div:has-text('Created:'):not(nav *)").first()).toBeVisible();
  19 |     await expect(page.locator("div:has-text('Modified:'):not(nav *)").first()).toBeVisible();
  20 |   });
  21 | 
  22 |   test("should display tags as clickable links", async ({ page }) => {
  23 |     // Look for tags in the note content area, not the sidebar
  24 |     const tags = page.locator("header a:has-text('1:1')");
  25 |     await expect(tags).toBeVisible();
  26 |     const managementTag = page.locator("header a:has-text('management')");
  27 |     await expect(managementTag).toBeVisible();
  28 |   });
  29 | 
  30 |   test("should display participants", async ({ page }) => {
  31 |     // Participants are in the header area
  32 |     await expect(page.locator("header span:has-text('Alice')")).toBeVisible();
  33 |   });
  34 | 
  35 |   test("should display note content", async ({ page }) => {
  36 |     await expect(page.locator(".markdown-body:has-text('Performance review preparation')")).toBeVisible();
  37 |     await expect(page.locator(".markdown-body:has-text('Career progression discussion')")).toBeVisible();
  38 |     await expect(page.locator(".markdown-body:has-text('Next Steps')")).toBeVisible();
  39 |   });
  40 | 
  41 |   test("should display same-day calendar events sidebar", async ({ page }) => {
  42 |     await expect(page.locator("h3:has-text('Same-day Events')")).toBeVisible();
  43 |     await expect(page.locator("div:has-text('1:1 Alice')").first()).toBeVisible();
  44 |     await expect(page.locator("div:has-text('Conference Room A')").first()).toBeVisible();
  45 |   });
  46 | 
  47 |   test("should display similar notes sidebar", async ({ page }) => {
  48 |     await expect(page.locator("h3:has-text('Similar Notes')")).toBeVisible();
  49 |     await expect(page.locator("div:has-text('1:1 with Alice - February 2024')")).toBeVisible();
  50 |     await expect(page.locator("div:has-text('1:1 with Alice - January 2024')")).toBeVisible();
  51 |   });
  52 | 
  53 |   test("should navigate to similar note on click", async ({ page }) => {
  54 |     await page.locator("div:has-text('1:1 with Alice - February 2024')").click();
  55 |     await expect(page).toHaveURL(/\/notes\/note-004/);
  56 |   });
  57 | 
  58 |   test("should have back navigation", async ({ page }) => {
  59 |     await expect(page.locator("button:has-text('Back')")).toBeVisible();
  60 |     await page.locator("button:has-text('Back')").click();
  61 |     await expect(page).not.toHaveURL(/\/notes\//);
  62 |   });
  63 | 
  64 |   test("should navigate to tag page when tag clicked", async ({ page }) => {
  65 |     await page.locator("header a:has-text('management')").click();
  66 |     await expect(page).toHaveURL(/\/tags\/management/);
  67 |   });
  68 | });
  69 | 
```