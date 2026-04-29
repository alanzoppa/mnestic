import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import ForceGraph3DView from "@/components/ForceGraph3DView";

vi.mock("react-force-graph-3d", () => ({
  __esModule: true,
  default: vi.fn(function MockForceGraph3D(props: any, ref: any) {
    return { type: "div", props: { "data-testid": "mock-force-graph" } };
  }),
}));

describe("ForceGraph3DView", () => {
  it("shows loading state when isLoading is true", () => {
    render(<ForceGraph3DView graphData={null} isLoading={true} error={null} />);
    expect(screen.getByText("Loading data...")).toBeInTheDocument();
  });

  it("shows error message when error is present", () => {
    const error = new Error("Test error");
    render(<ForceGraph3DView graphData={null} isLoading={false} error={error} />);
    expect(screen.getByText("Error")).toBeInTheDocument();
    expect(screen.getByText("Test error")).toBeInTheDocument();
  });

  it("shows no connections found when graphData has no nodes", () => {
    render(<ForceGraph3DView graphData={{ nodes: [], links: [] }} isLoading={false} error={null} />);
    expect(screen.getByText("No connections found.")).toBeInTheDocument();
  });
});