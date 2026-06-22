import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import LoginPage from "@/app/login/page";

const mockReplace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

describe("LoginPage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockReplace.mockClear();
    global.fetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ enabled: true }),
      } as Response);
    });
  });

  it("redirects to dashboard when auth is disabled", async () => {
    (global.fetch as any).mockReset();
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ enabled: false }),
    });

    render(<LoginPage />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/");
    });
  });

  it("submits password and redirects on success", async () => {
    (global.fetch as any).mockReset();
    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ enabled: true }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ status: "ok" }),
      });

    render(<LoginPage />);

    await waitFor(() => {
      expect(screen.getByLabelText("Password")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "secret-password" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Sign in/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/auth/login",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ password: "secret-password" }),
          credentials: "include",
        })
      );
    });

    expect(mockReplace).toHaveBeenCalledWith("/");
  });

  it("shows an error on failed login", async () => {
    let callIndex = 0;
    (global.fetch as any).mockReset();
    (global.fetch as any).mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      callIndex++;
      if (callIndex === 1) {
        return { ok: true, status: 200, json: async () => ({ enabled: true }) };
      }
      return { ok: false, status: 401, json: async () => ({ detail: "Invalid password" }) };
    });

    render(<LoginPage />);

    await waitFor(() => {
      expect(screen.getByLabelText("Password")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "wrong" },
    });

    await waitFor(() => {
      expect((screen.getByLabelText("Password") as HTMLInputElement).value).toBe("wrong");
    });

    fireEvent.click(screen.getByRole("button", { name: /Sign in/i }));

    await waitFor(() => {
      expect(screen.getByText(/Invalid password/i)).toBeInTheDocument();
    });

    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("toggles password visibility", async () => {
    render(<LoginPage />);

    await waitFor(() => {
      expect(screen.getByLabelText("Password")).toBeInTheDocument();
    });

    const input = screen.getByLabelText("Password") as HTMLInputElement;
    expect(input.type).toBe("password");

    fireEvent.click(screen.getByRole("button", { name: /Show password/i }));
    expect(input.type).toBe("text");

    fireEvent.click(screen.getByRole("button", { name: /Hide password/i }));
    expect(input.type).toBe("password");
  });
});
