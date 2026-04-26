import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, waitFor } from "@testing-library/react";
import TimelinePage from "@/app/timeline/page";

const mockPush = vi.fn();
const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: Infinity, retry: false } },
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/lib/api", () => ({
  getTimeline: vi.fn(),
}));

import { getTimeline } from "@/lib/api";

describe("TimelinePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not call Math.random during skeleton render (deterministic hydration-safe heights)", async () => {
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.5);

    let resolveTimeline: (value: unknown) => void;
    const timelinePromise = new Promise((resolve) => {
      resolveTimeline = resolve;
    });
    (getTimeline as any).mockReturnValue(timelinePromise);

    render(
      <QueryClientProvider client={queryClient}>
        <TimelinePage />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(document.querySelector(".animate-pulse")).toBeInTheDocument();
    });

    expect(randomSpy).not.toHaveBeenCalled();

    resolveTimeline!({
      periods: [{ period: "2024-01", count: 10, sample_ids: ["note-001"] }],
    });

    randomSpy.mockRestore();
  });
});
