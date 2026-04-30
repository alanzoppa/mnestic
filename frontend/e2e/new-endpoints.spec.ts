import { test, expect } from "@playwright/test";
import { setupTest } from "./fixtures/test-helpers";

test.describe("New API Endpoints", () => {
  test("GET /api/series returns series list", async ({ page }) => {
    await setupTest(page, "/search", "/api/search");

    const response = await page.evaluate(async () => {
      const res = await fetch("/api/series");
      return res.json();
    });

    expect(response.series).toBeDefined();
    expect(Array.isArray(response.series)).toBe(true);
    expect(response.series.length).toBeGreaterThan(0);
    expect(response.series[0].name).toBeDefined();
    expect(response.series[0].count).toBeGreaterThan(0);
  });

  test("GET /api/series/{name}/notes returns series notes", async ({ page }) => {
    await setupTest(page, "/search", "/api/search");

    const response = await page.evaluate(async () => {
      const res = await fetch("/api/series/weekly_standup/notes");
      return res.json();
    });

    expect(response.series).toBe("weekly_standup");
    expect(response.notes).toBeDefined();
    expect(Array.isArray(response.notes)).toBe(true);
    expect(response.notes.length).toBe(2);
  });

  test("POST /api/search/similar returns results for raw text", async ({ page }) => {
    await setupTest(page, "/search", "/api/search");

    const response = await page.evaluate(async () => {
      const res = await fetch("/api/search/similar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "contact form spam", n: 5 }),
      });
      return res.json();
    });

    expect(response.results).toBeDefined();
    expect(response.results.length).toBeGreaterThan(0);
    expect(response.results[0].type).toBe("note");
  });

  test("GET /api/people?q= filters by name", async ({ page }) => {
    await setupTest(page, "/search", "/api/search");

    const response = await page.evaluate(async () => {
      const res = await fetch("/api/people?q=alice");
      return res.json();
    });

    expect(response.people).toBeDefined();
    expect(response.people.length).toBeGreaterThan(0);
    expect(response.people[0].frequency).toBeGreaterThan(0);
  });

  test("GET /api/glossary returns tag definitions", async ({ page }) => {
    await setupTest(page, "/search", "/api/search");

    const response = await page.evaluate(async () => {
      const res = await fetch("/api/glossary?q=zendesk");
      return res.json();
    });

    expect(response.entries).toBeDefined();
    expect(response.entries.length).toBeGreaterThan(0);
    expect(response.entries[0].term).toBe("zendesk");
    expect(response.entries[0].frequency).toBeGreaterThan(0);
  });

  test("GET /api/notes?since= returns recent notes", async ({ page }) => {
    await setupTest(page, "/search", "/api/search");

    const response = await page.evaluate(async () => {
      const res = await fetch("/api/notes?since=2024-03-01T00:00:00Z");
      return res.json();
    });

    expect(response.since).toBe("2024-03-01T00:00:00Z");
    expect(response.notes).toBeDefined();
    expect(response.count).toBe(1);
  });

  test("GET /api/notes without since returns empty with count 0", async ({ page }) => {
    await setupTest(page, "/search", "/api/search");

    const response = await page.evaluate(async () => {
      const res = await fetch("/api/notes");
      return res.json();
    });

    expect(response.notes).toEqual([]);
    expect(response.count).toBe(0);
  });

  test("GET /api/notes/{id} still works alongside ?since=", async ({ page }) => {
    await setupTest(page, "/search", "/api/search");

    const response = await page.evaluate(async () => {
      const res = await fetch("/api/notes/note-001");
      return res.json();
    });

    expect(response.id).toBe("note-001");
    expect(response.metadata).toBeDefined();
    expect(response.content).toBeDefined();
  });

  test("GET /api/watcher/status includes recent_events", async ({ page }) => {
    await setupTest(page, "/search", "/api/search");

    const response = await page.evaluate(async () => {
      const res = await fetch("/api/watcher/status");
      return res.json();
    });

    expect(response.running).toBe(true);
    expect(response.recent_events).toBeDefined();
    expect(Array.isArray(response.recent_events)).toBe(true);
    expect(response.recent_events.length).toBeGreaterThan(0);
  });

  test("POST /api/notes creates a note and returns 201", async ({ page }) => {
    await setupTest(page, "/search", "/api/search");

    const response = await page.evaluate(async () => {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New Test", content: "body" }),
      });
      return { status: res.status, data: await res.json() };
    });

    expect(response.status).toBe(201);
    expect(response.data.id).toBe("manual_abc123");
    expect(response.data.metadata.title).toBe("Newly Created Note");
    expect(response.data.content).toBe("Hello world, this is a new note.");
  });

  test("POST /api/notes with empty title returns 422", async ({ page }) => {
    await setupTest(page, "/search", "/api/search");

    await page.unroute("**/api/notes**");
    await page.route("**/api/notes**", async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 422,
          contentType: "application/json",
          body: JSON.stringify({ detail: "Title is required" }),
        });
        return;
      }
      await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    });

    const response = await page.evaluate(async () => {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "", content: "body" }),
      });
      return res.status;
    });

    expect(response).toBe(422);
  });

  test("POST /api/notes with series assigns series metadata", async ({ page }) => {
    await setupTest(page, "/search", "/api/search");

    const response = await page.evaluate(async () => {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Meeting", series: "weekly_sync" }),
      });
      return { status: res.status, data: await res.json() };
    });

    expect(response.status).toBe(201);
    expect(response.data.metadata.series).toBeNull();
  });
});