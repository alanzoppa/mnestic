import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MultiTagInput } from "@/components/ui/MultiTagInput";

const mockTags = [
  { name: "work", count: 10 },
  { name: "personal", count: 5 },
  { name: "ideas", count: 8 },
  { name: "project", count: 3 },
  { name: "research", count: 12 },
];

describe("MultiTagInput", () => {
  it("renders with label and placeholder", () => {
    render(
      <MultiTagInput
        selectedTags={[]}
        allTags={mockTags}
        onChange={vi.fn()}
        label="Tags"
        placeholder="Add a tag..."
      />
    );
    expect(screen.getByText("Tags")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Add a tag...")).toBeInTheDocument();
  });

  it("displays selected tags as pills", () => {
    render(
      <MultiTagInput
        selectedTags={["work", "personal"]}
        allTags={mockTags}
        onChange={vi.fn()}
      />
    );
    expect(screen.getByText("work")).toBeInTheDocument();
    expect(screen.getByText("personal")).toBeInTheDocument();
  });

  it("removes tag when X is clicked on a pill", async () => {
    const handleChange = vi.fn();
    render(
      <MultiTagInput
        selectedTags={["work", "personal"]}
        allTags={mockTags}
        onChange={handleChange}
      />
    );
    const removeButtons = screen.getAllByLabelText(/Remove tag/);
    fireEvent.click(removeButtons[0]!);
    expect(handleChange).toHaveBeenCalledWith(["personal"]);
  });

  it("shows dropdown with filtered suggestions", async () => {
    render(
      <MultiTagInput
        selectedTags={[]}
        allTags={mockTags}
        onChange={vi.fn()}
      />
    );
    const input = screen.getByTestId("tag-input");
    fireEvent.change(input, { target: { value: "work" } });
    await waitFor(() => {
      expect(screen.getByText("work")).toBeInTheDocument();
    });
  });

  it("shows error message", () => {
    render(
      <MultiTagInput
        selectedTags={[]}
        allTags={mockTags}
        onChange={vi.fn()}
        error="Please select at least one tag"
      />
    );
    expect(screen.getByText("Please select at least one tag")).toBeInTheDocument();
  });
});
