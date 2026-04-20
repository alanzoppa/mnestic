# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: calendar.spec.ts >> Calendar Page >> should display calendar events on days
- Location: e2e/calendar.spec.ts:32:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('div:has-text(\'1:1 with Alice\')').first()
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for locator('div:has-text(\'1:1 with Alice\')').first()

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
  4  | test.describe("Calendar Page", () => {
  5  |   test.beforeEach(async ({ page }) => {
  6  |     await mockApiRoutes(page);
  7  |     await page.goto("/calendar");
  8  |   });
  9  | 
  10 |   test("should display page title", async ({ page }) => {
  11 |     const mainContent = page.locator("main");
  12 |     await expect(mainContent.getByRole('heading', { name: 'Calendar' })).toBeVisible();
  13 |   });
  14 | 
  15 |   test("should display month navigation", async ({ page }) => {
  16 |     await expect(page.locator('button:has-text("←")')).toBeVisible();
  17 |     await expect(page.locator('button:has-text("→")')).toBeVisible();
  18 |     // Month/Year display in calendar header
  19 |     await expect(page.locator("span:has-text('2024')")).toBeVisible();
  20 |   });
  21 | 
  22 |   test("should display calendar grid", async ({ page }) => {
  23 |     await expect(page.locator("text=Mon")).toBeVisible();
  24 |     await expect(page.locator("text=Tue")).toBeVisible();
  25 |     await expect(page.locator("text=Wed")).toBeVisible();
  26 |     await expect(page.locator("text=Thu")).toBeVisible();
  27 |     await expect(page.locator("text=Fri")).toBeVisible();
  28 |     await expect(page.locator("text=Sat")).toBeVisible();
  29 |     await expect(page.locator("text=Sun")).toBeVisible();
  30 |   });
  31 | 
  32 |   test("should display calendar events on days", async ({ page }) => {
> 33 |     await expect(page.locator("div:has-text('1:1 with Alice')").first()).toBeVisible();
     |                                                                          ^ Error: expect(locator).toBeVisible() failed
  34 |   });
  35 | 
  36 |   test("should navigate to day view on day click", async ({ page }) => {
  37 |     await page.locator('div:has-text("15")').nth(1).click();
  38 |     await expect(page).toHaveURL(/\/calendar\/2024-03-15/);
  39 |   });
  40 | 
  41 |   test("should have attendee filter", async ({ page }) => {
  42 |     await expect(page.locator('input[placeholder="Filter by attendee..."]')).toBeVisible();
  43 |   });
  44 | 
  45 |   test("should navigate between months", async ({ page }) => {
  46 |     await page.locator('button:has-text("→")').click();
  47 |     // Allow for timezone/locale variations in month display
  48 |     const currentMonthText = await page.locator('span.text-lg').textContent();
  49 |     expect(currentMonthText).toContain('2024');
  50 | 
  51 |     await page.locator('button:has-text("←")').click();
  52 |     await expect(page.locator("span:has-text('2024')")).toBeVisible();
  53 |   });
  54 | });
  55 | 
  56 | test.describe("Calendar Day Page", () => {
  57 |   test.beforeEach(async ({ page }) => {
  58 |     await mockApiRoutes(page);
  59 |     await page.goto("/calendar/2024-03-15");
  60 |   });
  61 | 
  62 |   test("should display date title", async ({ page }) => {
  63 |     // Match the formatted date shown in the UI
  64 |     const heading = page.getByRole('heading').filter({ hasText: /March|Friday/ }).first();
  65 |     await expect(heading).toBeVisible();
  66 |   });
  67 | 
  68 |   test("should have back button to calendar", async ({ page }) => {
  69 |     await expect(page.locator("text=Back to Calendar")).toBeVisible();
  70 |     await page.locator("text=Back to Calendar").click();
  71 |     await expect(page).toHaveURL(/\/calendar$/);
  72 |   });
  73 | 
  74 |   test("should display events section", async ({ page }) => {
  75 |     // Look for events specifically in the events section
  76 |     const eventsSection = page.locator("section").filter({ has: page.locator("h2:has-text('Events')") }).first();
  77 |     await expect(eventsSection.locator("h2:has-text('Events')")).toBeVisible();
  78 |     await expect(eventsSection.locator("h3:has-text('1:1 with Alice')")).toBeVisible();
  79 |     await expect(eventsSection.locator("text=Conference Room A")).toBeVisible();
  80 |   });
  81 | 
  82 |   test("should display notes section", async ({ page }) => {
  83 |     const notesSection = page.locator("section").filter({ has: page.locator("h2:has-text('Notes')") }).first();
  84 |     await expect(notesSection.locator("h2:has-text('Notes')")).toBeVisible();
  85 |     await expect(notesSection.locator("h3:has-text('1:1 with Alice - March 2024')")).toBeVisible();
  86 |   });
  87 | 
  88 |   test("should navigate to note from day view", async ({ page }) => {
  89 |     await page.locator("h3:has-text('1:1 with Alice - March 2024')").click();
  90 |     await expect(page).toHaveURL(/\/notes\/note-001/);
  91 |   });
  92 | });
  93 | 
```