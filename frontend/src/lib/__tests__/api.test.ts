import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock fetch
global.fetch = vi.fn();

describe("API Module", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("search", () => {
    it("should construct correct URL", async () => {
      const mockResponse = { results: [] };
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const { search } = await import("@/lib/api");
      await search("test query");

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/search"),
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
          }),
        })
      );
    });

    it("should include query in request body", async () => {
      const mockResponse = { results: [] };
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const { search } = await import("@/lib/api");
      await search("test query");

      const call = (global.fetch as any).mock.calls[0];
      const body = JSON.parse(call[1].body);
      expect(body.query).toBe("test query");
      expect(body.n).toBe(20);
    });

    it("should throw on API error", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const { search } = await import("@/lib/api");
      await expect(search("test")).rejects.toThrow("API error: 500");
    });
  });

  describe("getNote", () => {
    it("should encode note ID in URL", async () => {
      const mockResponse = {
        id: "note-001",
        metadata: {},
        content: "",
        calendar_events: [],
        similar_notes: [],
      };
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const { getNote } = await import("@/lib/api");
      await getNote("note-001");

      const calls = (global.fetch as any).mock.calls;
      expect(calls.length).toBe(1);
      expect(calls[0][0]).toContain("/api/notes/note-001");
    });
  });

  describe("getTags", () => {
    it("should fetch tags endpoint", async () => {
      const mockResponse = { tags: [], co_occurrence: [] };
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const { getTags } = await import("@/lib/api");
      await getTags();

      const calls = (global.fetch as any).mock.calls;
      expect(calls.length).toBe(1);
      expect(calls[0][0]).toContain("/api/tags");
    });
  });

  describe("getTimeline", () => {
    it("should include query params", async () => {
      const mockResponse = { periods: [] };
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const { getTimeline } = await import("@/lib/api");
      await getTimeline("month", "work");

      const calls = (global.fetch as any).mock.calls;
      expect(calls.length).toBe(1);
      expect(calls[0][0]).toContain("/api/timeline");
      expect(calls[0][0]).toContain("group_by=month");
      expect(calls[0][0]).toContain("tag=work");
    });
  });

  describe("getStats", () => {
    it("should return stats", async () => {
      const mockResponse = {
        total_notes: 100,
        total_tags: 20,
        total_calendar_events: 50,
        avg_note_length: 500,
        date_range: ["2019-01-01", "2024-12-31"],
      };
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const { getStats } = await import("@/lib/api");
      const stats = await getStats();

      expect(stats.total_notes).toBe(100);
      expect(stats.total_tags).toBe(20);
    });
  });

  describe("updateNote", () => {
    it("should send PATCH request with title", async () => {
      const mockResponse = {
        id: "note-001",
        metadata: { title: "Updated Title" },
        content: "body",
      };
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const { updateNote } = await import("@/lib/api");
      const result = await updateNote("note-001", { title: "Updated Title" });

      const calls = (global.fetch as any).mock.calls;
      expect(calls[0][0]).toContain("/api/notes/note-001");
      const opts = calls[0][1];
      expect(opts.method).toBe("PATCH");
      const body = JSON.parse(opts.body);
      expect(body.title).toBe("Updated Title");
      expect(result.metadata.title).toBe("Updated Title");
    });

    it("should send PATCH request with tags", async () => {
      const mockResponse = {
        id: "note-001",
        metadata: { tags: ["work", "new-tag"] },
        content: "body",
      };
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const { updateNote } = await import("@/lib/api");
      await updateNote("note-001", { tags: ["work", "new-tag"] });

      const body = JSON.parse((global.fetch as any).mock.calls[0][1].body);
      expect(body.tags).toEqual(["work", "new-tag"]);
    });

    it("should throw on API error", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const { updateNote } = await import("@/lib/api");
      await expect(updateNote("bad-id", { title: "x" })).rejects.toThrow("API error: 404");
    });
  });
});
