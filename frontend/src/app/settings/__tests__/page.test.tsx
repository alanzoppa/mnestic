import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import SettingsPage from "@/app/settings/page";

const mockPush = vi.fn();
const mockRefresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}));

function createQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
}

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <QueryClientProvider client={createQueryClient()}>{ui}</QueryClientProvider>
  );
}

const mockTokens = [
  {
    id: 1,
    name: "Widget",
    key_prefix: "mnest_abc123",
    created_at: "2024-01-01T00:00:00Z",
    last_used_at: null,
    revoked: false,
  },
  {
    id: 2,
    name: "Old token",
    key_prefix: "mnest_old456",
    created_at: "2023-12-01T00:00:00Z",
    last_used_at: "2024-01-02T00:00:00Z",
    revoked: true,
  },
];

describe("SettingsPage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockPush.mockClear();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    delete (global as any).fetch;
  });

  it("renders tokens fetched from the API", async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ tokens: mockTokens }),
    });

    renderWithProviders(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByText("Widget")).toBeInTheDocument();
    });

    expect(screen.getByText("Old token")).toBeInTheDocument();
    expect(screen.getByText("mnest_abc123")).toBeInTheDocument();
  });

  it("creates a token and shows the plaintext key", async () => {
    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ tokens: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ token: "mnest_plaintext_key" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          tokens: [
            {
              id: 3,
              name: "New token",
              key_prefix: "mnest_plain",
              created_at: "2024-02-01T00:00:00Z",
              last_used_at: null,
              revoked: false,
            },
          ],
        }),
      });

    renderWithProviders(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByTestId("token-name-input")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByTestId("token-name-input"), {
      target: { value: "New token" },
    });

    fireEvent.click(screen.getByTestId("create-token-button"));

    await waitFor(() => {
      expect(screen.getByText("mnest_plaintext_key")).toBeInTheDocument();
    });

    expect(screen.getByText(/will not be shown again/i)).toBeInTheDocument();
  });

  it("revokes a token after confirmation", async () => {
    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ tokens: mockTokens }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => undefined,
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          tokens: [{ ...mockTokens[0], revoked: true }, mockTokens[1]],
        }),
      });

    renderWithProviders(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByText("Widget")).toBeInTheDocument();
    });

    const revokeButtons = screen.getAllByLabelText(/Revoke token/i);
    fireEvent.click(revokeButtons[0]);

    const confirmButton = await screen.findByRole("button", { name: /Confirm/i });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/auth/keys/1"),
        expect.objectContaining({ method: "DELETE" })
      );
    });
  });
});
