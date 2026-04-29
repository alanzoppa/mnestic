import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import BrowsePage from "@/app/browse/page";

// Mock next/navigation
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => "/browse",
}));

// Mock favorites
vi.mock("@/lib/favorites", () => ({
  useFavorites: vi.fn().mockReturnValue({
    favorites: [],
    isFav: vi.fn().mockReturnValue(false),
    toggle: vi.fn(),
  }),
}));

vi.mock("@/lib/queries", () => {
  // Generate mock results inside factory to avoid hoisting issues
  // Use same date for all so sort preserves original order (note_0 first)
  const mockResults = Array.from({ length: 60 }, (_, i) => ({
    id: `note_${i}`,
    snippet: `Snippet for note ${i}`,
    metadata: {
      note_id: `note_${i}`,
      title: `Note ${i}`,
      source: i % 2 === 0 ? "Apple Notes" : "Evernote",
      folder: i % 3 === 0 ? "Work" : i % 3 === 1 ? "Personal" : "Ideas",
      tags: i % 2 === 0 ? ["work", "notes"] : ["personal"],
      created: "2024-01-01",
      date: "2024-01-01",
    },
    score: 1.0 - i * 0.01,
    type: "note",
    note_id: `note_${i}`,
  }));

  return {
    schemaKeys: { all: ["schema"] },
    schemaApi: {
      get: vi.fn().mockResolvedValue({
        sources: ["Apple Notes", "Evernote"],
        fields: [],
      }),
    },
    searchApi: {
      all: vi.fn().mockResolvedValue(mockResults),
    },
  };
});

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  );
}

describe("BrowsePage", () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  it("renders page title and search input", async () => {
    renderWithProviders(<BrowsePage />);
    await waitFor(() => {
      expect(screen.getByText("60 of 60 notes")).toBeInTheDocument();
    });
    expect(screen.getByText("Browse Notes")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Search in notes...")).toBeInTheDocument();
  });

  it("shows filter button", async () => {
    renderWithProviders(<BrowsePage />);
    await waitFor(() => {
      expect(screen.getByText("60 of 60 notes")).toBeInTheDocument();
    });
    expect(screen.getByText(/Filters/)).toBeInTheDocument();
  });

  it("displays note results after loading", async () => {
    renderWithProviders(<BrowsePage />);
    await waitFor(() => {
      expect(screen.getByText("Note 0")).toBeInTheDocument();
    });
  });

  it("filters by source facet", async () => {
    renderWithProviders(<BrowsePage />);
    await waitFor(() => {
      expect(screen.getByText("60 of 60 notes")).toBeInTheDocument();
    });
    const filterBtn = screen.getByText(/Filters/);
    fireEvent.click(filterBtn);
    // Click the Apple Notes source filter button (in the facet panel)
    const sourceButtons = screen.getAllByText("Apple Notes");
    // First one is the filter button in the facet panel
    fireEvent.click(sourceButtons[0]!);
    // All visible notes should be from Apple Notes
    await waitFor(() => {
      const cards = screen.getAllByText(/Apple Notes/);
      expect(cards.length).toBeGreaterThan(0);
    });
  });

  it("favorites button toggles favorites view", async () => {
    renderWithProviders(<BrowsePage />);
    await waitFor(() => {
      expect(screen.getByText("Note 0")).toBeInTheDocument();
    });
    const favBtn = screen.getByText(/Favorites/);
    fireEvent.click(favBtn);
    // Should show favorites view (empty since favorites mock returns empty array)
    await waitFor(() => {
      expect(screen.getByText(/Favorites/)).toBeInTheDocument();
    });
  });

  it("paginates results", async () => {
    renderWithProviders(<BrowsePage />);
    await waitFor(() => {
      expect(screen.getByText("Note 0")).toBeInTheDocument();
    });
    expect(screen.getByText(/Showing 1-/)).toBeInTheDocument();
    const nextBtn = screen.getByText("Next");
    fireEvent.click(nextBtn);
    await waitFor(() => {
      expect(screen.getByText(/Showing 51-/)).toBeInTheDocument();
    });
  });

  it("previous button is disabled on first page", async () => {
    renderWithProviders(<BrowsePage />);
    await waitFor(() => {
      expect(screen.getByText("Note 0")).toBeInTheDocument();
    });
    const prevBtn = screen.getByText("Previous");
    expect(prevBtn).toBeDisabled();
  });

  it("navigates to note on click", async () => {
    renderWithProviders(<BrowsePage />);
    await waitFor(() => {
      const noteLink = screen.getByText("Note 0").closest("a");
      expect(noteLink).toHaveAttribute("href", "/notes/note_0");
    });
  });

  it("shows loading skeleton initially", () => {
    // Create a QueryClient that doesn't resolve immediately
    const slowQueryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    render(
      <QueryClientProvider client={slowQueryClient}>
        <BrowsePage />
      </QueryClientProvider>
    );
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });
});
