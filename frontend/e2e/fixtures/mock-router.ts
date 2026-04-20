import { Page } from "@playwright/test";
import {
  mockStats,
  mockSearchResults,
  mockNoteDetail,
  mockTags,
  mockTimeline,
  mockGraph,
  mockCalendarEvents,
  mockCalendarDate,
  mockSchema,
} from "./api-fixtures";

export async function mockApiRoutes(page: Page) {
  // Stats
  await page.route("**/api/stats", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(mockStats),
    });
  });

  // Search
  await page.route("**/api/search", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(mockSearchResults),
    });
  });

  // Note detail - matches pattern /api/notes/{id}
  await page.route("**/api/notes/*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(mockNoteDetail),
    });
  });

  // Tags
  await page.route("**/api/tags", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(mockTags),
    });
  });

  // Timeline
  await page.route("**/api/timeline**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(mockTimeline),
    });
  });

  // Graph
  await page.route("**/api/graph**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(mockGraph),
    });
  });

  // Similar notes
  await page.route("**/api/similar/*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        notes: mockNoteDetail.similar_notes,
      }),
    });
  });

  // Calendar events
  await page.route("**/api/calendar**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(mockCalendarEvents),
    });
  });

  // Calendar date
  await page.route("**/api/calendar/date/*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(mockCalendarDate),
    });
  });

  // Calendar event detail
  await page.route("**/api/calendar/*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(mockCalendarEvents.events[0]),
    });
  });

  // Schema
  await page.route("**/api/schema", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(mockSchema),
    });
  });

  // Ingest
  await page.route("**/api/ingest", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        notes_result: {
          notes_ingested: 10,
          notes_skipped: 0,
          chunks_created: 15,
        },
        calendar_result: {
          events_ingested: 25,
        },
      }),
    });
  });
}

export async function mockApiRoutesWithDelay(page: Page, delayMs: number = 500) {
  const mockWithDelay = async (body: object) => {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    return JSON.stringify(body);
  };

  await page.route("**/api/stats", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: await mockWithDelay(mockStats),
    });
  });

  await page.route("**/api/search", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: await mockWithDelay(mockSearchResults),
    });
  });

  await page.route("**/api/notes/*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: await mockWithDelay(mockNoteDetail),
    });
  });

  await page.route("**/api/tags", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: await mockWithDelay(mockTags),
    });
  });

  await page.route("**/api/timeline**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: await mockWithDelay(mockTimeline),
    });
  });

  await page.route("**/api/graph**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: await mockWithDelay(mockGraph),
    });
  });

  await page.route("**/api/similar/*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: await mockWithDelay({ notes: mockNoteDetail.similar_notes }),
    });
  });

  await page.route("**/api/calendar**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: await mockWithDelay(mockCalendarEvents),
    });
  });

  await page.route("**/api/calendar/date/*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: await mockWithDelay(mockCalendarDate),
    });
  });

  await page.route("**/api/calendar/*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: await mockWithDelay(mockCalendarEvents.events[0]),
    });
  });

  await page.route("**/api/schema", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: await mockWithDelay(mockSchema),
    });
  });

  await page.route("**/api/ingest", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: await mockWithDelay({
        notes_result: { notes_ingested: 10, notes_skipped: 0, chunks_created: 15 },
        calendar_result: { events_ingested: 25 },
      }),
    });
  });
}
