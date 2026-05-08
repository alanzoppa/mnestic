import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import SearchGraphPage from "@/app/search-graph/page";

const mockPush = vi.fn();
const mockReplace = vi.fn();

let searchParams = new URLSearchParams("q=test");

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/search-graph",
  useSearchParams: () => searchParams,
}));

const mockGet = vi.fn().mockResolvedValue({
  nodes: [
    { id: "n1", title: "Note 1", folder: "Work", tags: ["work"], source: "Apple Notes", created: "2024-01-01", search_score: 0.85 },
    { id: "n2", title: "Note 2", folder: "Personal", tags: ["personal"], source: "Apple Notes", created: "2024-01-02", search_score: 0.72 },
  ],
  edges: [{ source: "n1", target: "n2", weight: 0.78 }],
});

vi.mock("@/lib/queries", () => ({
  searchGraphKeys: {
    all: (q: string, t?: number, n?: number) => ["search-graph", q, t ?? "", n ?? ""],
  },
  searchGraphApi: {
    get: (...args: any[]) => mockGet(...args),
  },
}));

vi.mock("@/components/ForceGraph3DView", () => ({
  default: ({ graphData, isLoading, error, headerSlot, legendSlot, detailPaneSlot, placeholderSlot }: any) => {
    if (isLoading) return <div>{headerSlot}<div>Loading data...</div></div>;
    if (error) return <div>{headerSlot}<div>Error</div></div>;
    if (placeholderSlot && !graphData) return <div>{headerSlot}{placeholderSlot}</div>;
    if (!graphData || graphData.nodes.length === 0) return <div>{headerSlot}<div>No connections found.</div></div>;
    return (
      <div>
        {headerSlot}
        <div data-testid="graph-container">
          {legendSlot}
          {graphData.nodes.map((n: any) => <div key={n.id}>{n.title}</div>)}
        </div>
        {detailPaneSlot}
      </div>
    );
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

describe("SearchGraphPage", () => {
  beforeEach(() => {
    mockGet.mockClear();
    mockGet.mockResolvedValue({
      nodes: [
        { id: "n1", title: "Note 1", folder: "Work", tags: ["work"], source: "Apple Notes", created: "2024-01-01", search_score: 0.85 },
        { id: "n2", title: "Note 2", folder: "Personal", tags: ["personal"], source: "Apple Notes", created: "2024-01-02", search_score: 0.72 },
      ],
      edges: [{ source: "n1", target: "n2", weight: 0.78 }],
    });
    searchParams = new URLSearchParams("q=test");
  });

  it("renders search input and controls", async () => {
    renderWithProviders(<SearchGraphPage />);
    await waitFor(() => {
      expect(screen.getByTestId("graph-container")).toBeInTheDocument();
    });
    expect(screen.getByPlaceholderText(/search query/i)).toBeInTheDocument();
    expect(screen.getByText("Search Graph")).toBeInTheDocument();
  });

  it("shows placeholder when no query param", () => {
    searchParams = new URLSearchParams();
    renderWithProviders(<SearchGraphPage />);
    expect(screen.getByText(/enter a search query to visualize results/i)).toBeInTheDocument();
  });

  it("renders graph when query param is provided and API returns data", async () => {
    renderWithProviders(<SearchGraphPage />);
    await waitFor(() => {
      expect(screen.getByTestId("graph-container")).toBeInTheDocument();
    });
    expect(screen.getByText("Note 1")).toBeInTheDocument();
    expect(screen.getByText("Note 2")).toBeInTheDocument();
  });

  it("renders loading state when query is set but data has not loaded", async () => {
    mockGet.mockImplementation(() => new Promise(() => {}));
    renderWithProviders(<SearchGraphPage />);
    await waitFor(() => {
      expect(screen.getByText("Loading data...")).toBeInTheDocument();
    });
  });
});