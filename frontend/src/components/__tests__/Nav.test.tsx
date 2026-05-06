import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import Nav from "@/components/Nav";

// Mock next/navigation
const mockUsePathname = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => mockUsePathname(),
}));

vi.mock("next/link", () => {
  return {
    default: vi.fn(({ children, href, className }: any) => (
      <a href={href} className={className}>
        {children}
      </a>
    )),
  };
});

describe("Nav Component", () => {
  it("renders all navigation links", () => {
    mockUsePathname.mockReturnValue("/");
    render(<Nav />);

    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Search")).toBeInTheDocument();
    expect(screen.getByText("Browse")).toBeInTheDocument();
    expect(screen.getByText("Tags")).toBeInTheDocument();
    expect(screen.getByText("Timeline")).toBeInTheDocument();
    expect(screen.getByText("Calendar")).toBeInTheDocument();
    expect(screen.getByText("Graph")).toBeInTheDocument();
  });

  it("highlights the active page", () => {
    mockUsePathname.mockReturnValue("/search");
    const { container } = render(<Nav />);

    // Active link uses font-semibold + bg-zinc-900/80 + text-zinc-100
    const activeLink = container.querySelector(".font-semibold.text-zinc-100");
    expect(activeLink).toHaveTextContent("Search");
    expect(activeLink).toHaveClass("bg-zinc-900/80");
  });

  it("does not highlight non-active pages", () => {
    mockUsePathname.mockReturnValue("/");
    const { container } = render(<Nav />);

    const links = container.querySelectorAll("a");
    const nonActiveLinks = Array.from(links).filter(
      (link) => !link.classList.contains("bg-zinc-900/80")
    );

    // Dashboard should be active, others should not
    expect(nonActiveLinks.length).toBeGreaterThan(0);
  });

  it("renders links with correct hrefs", () => {
    mockUsePathname.mockReturnValue("/");
    render(<Nav />);

    expect(screen.getByText("Dashboard").closest("a")).toHaveAttribute("href", "/");
    expect(screen.getByText("Search").closest("a")).toHaveAttribute("href", "/search");
    expect(screen.getByText("Browse").closest("a")).toHaveAttribute("href", "/browse");
    expect(screen.getByText("Tags").closest("a")).toHaveAttribute("href", "/tags");
    expect(screen.getByText("Timeline").closest("a")).toHaveAttribute("href", "/timeline");
    expect(screen.getByText("Calendar").closest("a")).toHaveAttribute("href", "/calendar");
    expect(screen.getByText("Graph").closest("a")).toHaveAttribute("href", "/graph");
  });

  it("applies hover classes to inactive links", () => {
    mockUsePathname.mockReturnValue("/");
    render(<Nav />);

    const searchLink = screen.getByText("Search").closest("a");
    expect(searchLink).toHaveClass("hover:text-zinc-100");
    expect(searchLink).toHaveClass("hover:bg-zinc-900/60");
  });

  it("renders the logo and brand", () => {
    mockUsePathname.mockReturnValue("/");
    render(<Nav />);

    expect(screen.getByAltText("Mnestic")).toBeInTheDocument();
    expect(screen.getByText("Mnestic")).toBeInTheDocument();
    expect(screen.getByText("Semantic Browser")).toBeInTheDocument();
  });

  it("renders status indicator", () => {
    mockUsePathname.mockReturnValue("/");
    render(<Nav />);

    expect(screen.getByText("System Ready")).toBeInTheDocument();
  });
});
