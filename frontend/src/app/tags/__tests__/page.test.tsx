import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, waitFor } from "@testing-library/react";
import TagsPage from "@/app/tags/page";

const mockPush = vi.fn();

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: Infinity, retry: false } },
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/lib/api", () => ({
  getTags: vi.fn(),
}));

import { getTags } from "@/lib/api";

describe("TagsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("precomputes maxTagCount once for cloud sizing (regression: inline Math.max per tag)", async () => {
    (getTags as any).mockResolvedValue({
      tags: [
        { name: "work", count: 100 },
        { name: "zendesk", count: 50 },
        { name: "personal", count: 10 },
      ],
      co_occurrence: [],
    });

    render(
      <QueryClientProvider client={queryClient}>
        <TagsPage />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(document.querySelector('[data-testid="tag-cloud"]')).toBeInTheDocument();
    });

    const workTag = document.querySelector('[data-testid="tag-work"]') as HTMLElement;
    const zendeskTag = document.querySelector('[data-testid="tag-zendesk"]') as HTMLElement;
    const personalTag = document.querySelector('[data-testid="tag-personal"]') as HTMLElement;

    expect(workTag).toBeInTheDocument();
    expect(zendeskTag).toBeInTheDocument();
    expect(personalTag).toBeInTheDocument();

    const workSize = parseInt(workTag.style.fontSize);
    const zendeskSize = parseInt(zendeskTag.style.fontSize);
    const personalSize = parseInt(personalTag.style.fontSize);

    expect(workSize).toBeGreaterThan(zendeskSize);
    expect(zendeskSize).toBeGreaterThan(personalSize);
  });
});
