import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import CreateNotePage from "@/app/create/page";

const mockPush = vi.fn();
const mockBack = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, back: mockBack }),
}));

vi.mock("@/lib/queries", () => ({
  tagKeys: { all: ["tags"] },
  tagsApi: { all: vi.fn().mockResolvedValue({ tags: [], co_occurrence: [] }) },
  schemaApi: { get: vi.fn().mockResolvedValue({ folders: ["Notes", "Work"] }) },
  peopleApi: { all: vi.fn().mockResolvedValue([]) },
  useCreateNote: vi.fn().mockReturnValue({
    mutate: vi.fn().mockImplementation((data, callbacks) => {
      callbacks?.onSuccess({ id: "new-note-id" });
    }),
    isPending: false,
  }),
}));

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
}

describe("CreateNotePage", () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockBack.mockClear();
  });

  it("renders the form with all expected fields", () => {
    renderWithProviders(<CreateNotePage />);
    expect(screen.getByTestId("create-title")).toBeInTheDocument();
    expect(screen.getByTestId("create-content")).toBeInTheDocument();
    expect(screen.getByTestId("create-folder")).toBeInTheDocument();
    expect(screen.getByTestId("create-submit")).toBeInTheDocument();
    expect(screen.getByTestId("create-cancel")).toBeInTheDocument();
  });

  it("shows validation error on empty title submit", async () => {
    renderWithProviders(<CreateNotePage />);
    const form = screen.getByTestId("create-title").closest("form")!;
    fireEvent.submit(form);
    await waitFor(() => {
      expect(screen.getByText("Title is required")).toBeInTheDocument();
    });
  });

  it("submits form successfully", async () => {
    renderWithProviders(<CreateNotePage />);
    fireEvent.change(screen.getByTestId("create-title"), {
      target: { value: "My New Note" },
    });
    const form = screen.getByTestId("create-title").closest("form")!;
    fireEvent.submit(form);
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/notes/new-note-id");
    });
  });

  it("cancel button calls router.back", () => {
    renderWithProviders(<CreateNotePage />);
    fireEvent.click(screen.getByTestId("create-cancel"));
    expect(mockBack).toHaveBeenCalled();
  });
});
