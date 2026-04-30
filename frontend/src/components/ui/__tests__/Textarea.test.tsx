import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Textarea } from "@/components/ui/Textarea";

describe("Textarea", () => {
  it("renders with label", () => {
    render(<Textarea label="Description" />);
    expect(screen.getByText("Description")).toBeInTheDocument();
  });

  it("shows error message", () => {
    render(<Textarea error="This field is required" />);
    expect(screen.getByText("This field is required")).toBeInTheDocument();
  });

  it("forwards onChange events", () => {
    const handleChange = vi.fn();
    render(<Textarea onChange={handleChange} />);
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Hello world" },
    });
    expect(handleChange).toHaveBeenCalledTimes(1);
  });

  it("accepts className merge", () => {
    const { container } = render(
      <Textarea className="custom-class font-mono" />
    );
    const textarea = container.querySelector("textarea");
    expect(textarea).toHaveClass("custom-class");
    expect(textarea).toHaveClass("font-mono");
  });
});
