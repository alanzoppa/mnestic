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

// 1x1 transparent PNG for mock images
const MOCK_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

export interface MockOptions {
  debug?: boolean;
}

function createLogger(debug: boolean) {
  return (msg: string) => {
    if (debug) {
      console.log(`[Mock:${process.pid}] ${msg}`);
    }
  };
}

export async function mockApiRoutes(page: Page, options?: MockOptions) {
  const debug = options?.debug ?? process.env.DEBUG_TESTS === "true";
  const log = createLogger(debug);

  log("Setting up mock API routes...");

  // Stats
  await page.route("**/api/stats", async (route) => {
    log(`→ ${route.request().method()} ${route.request().url()}`);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(mockStats),
    });
    log(`← 200 ${route.request().url()}`);
  });

  // Search
  await page.route("**/api/search", async (route) => {
    log(`→ ${route.request().method()} ${route.request().url()}`);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(mockSearchResults),
    });
    log(`← 200 ${route.request().url()}`);
  });

  let currentNote = { ...mockNoteDetail };

  // Note detail - matches pattern /api/notes/{id}
  await page.route("**/api/notes/*", async (route) => {
    log(`→ ${route.request().method()} ${route.request().url()}`);
    if (route.request().method() === "PATCH") {
      const body = route.request().postDataJSON();
      if (body?.title) {
        currentNote = { ...currentNote, metadata: { ...currentNote.metadata, title: body.title } };
      }
      if (body?.tags) {
        currentNote = { ...currentNote, metadata: { ...currentNote.metadata, tags: body.tags } };
      }
      if (body?.participants) {
        currentNote = { ...currentNote, metadata: { ...currentNote.metadata, participants: body.participants } };
      }
      if (body?.content) {
        currentNote = { ...currentNote, content: body.content };
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: currentNote.id,
          metadata: currentNote.metadata,
          content: currentNote.content,
        }),
      });
      log(`← 200 PATCH ${route.request().url()}`);
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(currentNote),
    });
    log(`← 200 ${route.request().url()}`);
  });

  // Tags
  await page.route("**/api/tags", async (route) => {
    log(`→ ${route.request().method()} ${route.request().url()}`);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(mockTags),
    });
    log(`← 200 ${route.request().url()}`);
  });

  // Timeline
  await page.route("**/api/timeline**", async (route) => {
    log(`→ ${route.request().method()} ${route.request().url()}`);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(mockTimeline),
    });
    log(`← 200 ${route.request().url()}`);
  });

  // Graph
  await page.route("**/api/graph**", async (route) => {
    log(`→ ${route.request().method()} ${route.request().url()}`);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(mockGraph),
    });
    log(`← 200 ${route.request().url()}`);
  });

  // Similar notes
  await page.route("**/api/similar/*", async (route) => {
    log(`→ ${route.request().method()} ${route.request().url()}`);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        notes: mockNoteDetail.similar_notes,
      }),
    });
    log(`← 200 ${route.request().url()}`);
  });

  // IMPORTANT: Order matters for calendar routes!
  // More specific patterns must be registered before generic ones

  // Calendar date - specific pattern (must come before generic calendar patterns)
  await page.route("**/api/calendar/date/*", async (route) => {
    log(`→ ${route.request().method()} ${route.request().url()}`);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(mockCalendarDate),
    });
    log(`← 200 ${route.request().url()}`);
  });

  // Calendar event detail - matches /api/calendar/{event_id}
  // Use a more specific pattern to avoid matching /api/calendar/date/*
  await page.route("**/api/calendar/[!d]*", async (route) => {
    log(`→ ${route.request().method()} ${route.request().url()}`);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(mockCalendarEvents.events[0]),
    });
    log(`← 200 ${route.request().url()}`);
  });

  // Calendar events list - generic pattern (must come last)
  await page.route("**/api/calendar**", async (route) => {
    log(`→ ${route.request().method()} ${route.request().url()}`);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(mockCalendarEvents),
    });
    log(`← 200 ${route.request().url()}`);
  });

  // Schema
  await page.route("**/api/schema", async (route) => {
    log(`→ ${route.request().method()} ${route.request().url()}`);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(mockSchema),
    });
    log(`← 200 ${route.request().url()}`);
  });

  // People
  await page.route("**/api/people", async (route) => {
    log(`→ ${route.request().method()} ${route.request().url()}`);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        people: [
          { name: "Alice Smith", aliases: ["Alice"], context: "direct report" },
          { name: "Bob Jones", aliases: ["Bob"], context: "colleague" },
          { name: "Valentin Cekov", aliases: ["Val"], context: "principal engineer" },
        ],
      }),
    });
    log(`← 200 ${route.request().url()}`);
  });

  // Ingest
  await page.route("**/api/ingest", async (route) => {
    log(`→ ${route.request().method()} ${route.request().url()}`);
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
    log(`← 200 ${route.request().url()}`);
  });

  // Images - return a 1x1 transparent PNG
  await page.route("**/api/images/**", async (route) => {
    log(`→ ${route.request().method()} ${route.request().url()}`);
    await route.fulfill({
      status: 200,
      contentType: "image/png",
      body: MOCK_PNG,
    });
    log(`← 200 ${route.request().url()}`);
  });

  log("Mock API routes setup complete");
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

  // Calendar date - specific pattern (must come before generic)
  await page.route("**/api/calendar/date/*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: await mockWithDelay(mockCalendarDate),
    });
  });

  // Calendar event detail - matches /api/calendar/{event_id} but not /api/calendar/date/*
  await page.route("**/api/calendar/[!d]*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: await mockWithDelay(mockCalendarEvents.events[0]),
    });
  });

  // Calendar events list - generic pattern (must come last)
  await page.route("**/api/calendar**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: await mockWithDelay(mockCalendarEvents),
    });
  });

  await page.route("**/api/schema", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: await mockWithDelay(mockSchema),
    });
  });

  await page.route("**/api/people", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: await mockWithDelay({
        people: [
          { name: "Alice Smith", aliases: ["Alice"], context: "direct report" },
          { name: "Bob Jones", aliases: ["Bob"], context: "colleague" },
          { name: "Valentin Cekov", aliases: ["Val"], context: "principal engineer" },
        ],
      }),
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
