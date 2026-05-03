import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import SearchPage from "@/app/search/page";

// Mock next/navigation
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => "/search",
}));

// Mock the API layer
vi.mock("@/lib/queries", () => ({
  tagKeys: { all: ["tags"] },
  schemaKeys: { all: ["schema"] },
  tagsApi: {
    all: vi.fn().mockResolvedValue({
      tags: [
        { name: "work", count: 50 },
        { name: "personal", count: 30 },
        { name: "notes", count: 20 },
        { name: "test", count: 15 },
        { name: "dev", count: 10 },
      ],
      co_occurrence: [],
    }),
  },
  schemaApi: {
    get: vi.fn().mockResolvedValue({ sources: ["Apple Notes", "Evernote"], fields: [] }),
  },
  searchApi: {
    all: vi.fn().mockImplementation(async ({ query }) => {
      if (!query || query === "*") return [];
      return [
        {
          id: "note1",
          title: "Test Note",
          snippet: "This is a test note content",
          metadata: {
            source: "Apple Notes",
            folder: "Work",
            tags: ["work", "test"],
            created: "2024-01-01",
          },
          score: 0.95,
          type: "note",
          note_id: "note1",
        },
      ];
    }),
  },
}));

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

describe("SearchPage", () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  it("renders search input and popular tags on initial load", async () => {
    renderWithProviders(<SearchPage />);
    expect(screen.getByPlaceholderText("Enter your search query...")).toBeInTheDocument();
    expect(screen.getByText("Search")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId("popular-tags-label")).toBeInTheDocument();
    });
  });

  it("shows filter panel when filter toggle is clicked", async () => {
    renderWithProviders(<SearchPage />);
    const toggle = screen.getByTestId("filter-toggle");
    fireEvent.click(toggle);
    await waitFor(() => {
      expect(screen.getByTestId("filter-panel")).toBeVisible();
    });
  });

  it("source filter buttons appear after opening filter panel", async () => {
    renderWithProviders(<SearchPage />);
    await waitFor(() => {
      expect(screen.getByTestId("filter-toggle")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId("filter-toggle"));
    await waitFor(() => {
      expect(screen.getByTestId("filter-source-Apple Notes")).toBeInTheDocument();
    });
    const appleBtn = screen.getByTestId("filter-source-Apple Notes");
    fireEvent.click(appleBtn);
    expect(appleBtn).toHaveAttribute("data-active", "true");
    const allBtn = screen.getByTestId("filter-source-all");
    expect(allBtn).toHaveAttribute("data-active", "false");
  });

  it("performs search and displays results", async () => {
    renderWithProviders(<SearchPage />);
    const input = screen.getByPlaceholderText("Enter your search query...");
    const searchBtn = screen.getByText("Search");

    await userEvent.type(input, "test query");
    fireEvent.click(searchBtn);

    await waitFor(() => {
      expect(screen.getByText("Test Note")).toBeInTheDocument();
    });
  });

  it("navigates to note on result click", async () => {
    renderWithProviders(<SearchPage />);
    const input = screen.getByPlaceholderText("Enter your search query...");
    const searchBtn = screen.getByText("Search");

    await userEvent.type(input, "test query");
    fireEvent.click(searchBtn);

    await waitFor(() => {
      expect(screen.getByText("Test Note")).toBeInTheDocument();
    });

    const link = screen.getByRole("link", { name: /Test Note/ });
    expect(link).toHaveAttribute("href", "/notes/note1");
  });

  it("date range picker is visible", () => {
    renderWithProviders(<SearchPage />);
    expect(screen.getByTestId("date-range-picker")).toBeInTheDocument();
  });
});
