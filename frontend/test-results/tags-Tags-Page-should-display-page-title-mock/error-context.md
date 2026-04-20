# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tags.spec.ts >> Tags Page >> should display page title
- Location: e2e/tags.spec.ts:10:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('heading', { name: 'Tag Explorer' })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByRole('heading', { name: 'Tag Explorer' })

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
  4  | test.describe("Tags Page", () => {
  5  |   test.beforeEach(async ({ page }) => {
  6  |     await mockApiRoutes(page);
  7  |     await page.goto("/tags");
  8  |   });
  9  | 
  10 |   test("should display page title", async ({ page }) => {
> 11 |     await expect(page.getByRole('heading', { name: 'Tag Explorer' })).toBeVisible();
     |                                                                       ^ Error: expect(locator).toBeVisible() failed
  12 |   });
  13 | 
  14 |   test("should display tag cloud", async ({ page }) => {
  15 |     await expect(page.locator("text=Tag Cloud")).toBeVisible();
  16 |     // Look for tags specifically within the tag cloud section
  17 |     await expect(page.locator("button:has-text('work')")).toBeVisible();
  18 |     await expect(page.locator("button:has-text('1:1')")).toBeVisible();
  19 |     await expect(page.locator("button:has-text('evernote')")).toBeVisible();
  20 |   });
  21 | 
  22 |   test("should show tag counts", async ({ page }) => {
  23 |     // Tag counts should appear within the tag cloud
  24 |     await expect(page.locator("text=287").first()).toBeVisible();
  25 |     await expect(page.locator("text=45").first()).toBeVisible();
  26 |   });
  27 | 
  28 |   test("should have structural tag indicator", async ({ page }) => {
  29 |     await expect(page.locator("text=Structural").first()).toBeVisible();
  30 |   });
  31 | 
  32 |   test("should have content tag indicator", async ({ page }) => {
  33 |     await expect(page.locator("text=Content").first()).toBeVisible();
  34 |   });
  35 | 
  36 |   test("should navigate to tag detail on click", async ({ page }) => {
  37 |     await page.locator("button:has-text('work')").first().click();
  38 |     await expect(page).toHaveURL(/\/tags\/work/);
  39 |   });
  40 | 
  41 |   test("should display co-occurrence table", async ({ page }) => {
  42 |     await expect(page.locator("text=Top Co-occurring Tags")).toBeVisible();
  43 |     await expect(page.locator("th:has-text('Tag 1')")).toBeVisible();
  44 |     await expect(page.locator("th:has-text('Tag 2')")).toBeVisible();
  45 |     await expect(page.locator("th:has-text('Count')")).toBeVisible();
  46 |   });
  47 | });
  48 | 
  49 | test.describe("Tag Detail Page", () => {
  50 |   test.beforeEach(async ({ page }) => {
  51 |     await mockApiRoutes(page);
  52 |     await page.goto("/tags/work");
  53 |   });
  54 | 
  55 |   test("should display tag name and count", async ({ page }) => {
  56 |     // The h1 should contain the tag name
  57 |     const h1 = page.getByRole('heading').first();
  58 |     await expect(h1).toContainText("work");
  59 |   });
  60 | 
  61 |   test("should have back button to tags page", async ({ page }) => {
  62 |     await expect(page.locator("text=Back to Tags")).toBeVisible();
  63 |     await page.locator("text=Back to Tags").click();
  64 |     await expect(page).toHaveURL(/\/tags$/);
  65 |   });
  66 | 
  67 |   test("should display notes with this tag", async ({ page }) => {
  68 |     await expect(page.locator("h3:has-text('Zendesk Chat Architecture Review')")).toBeVisible();
  69 |   });
  70 | 
  71 |   test("should navigate to note from tag results", async ({ page }) => {
  72 |     await page.locator("h3:has-text('Zendesk Chat Architecture Review')").click();
  73 |     await expect(page).toHaveURL(/\/notes\/note-002/);
  74 |   });
  75 | });
  76 | 
```