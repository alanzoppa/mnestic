import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

vi.mock("next/dynamic", () => ({
  default:
    (_importFn: () => Promise<any>, _opts?: any) =>
    React.forwardRef<any, any>(function Wrapped(_props: any, ref: any) {
      React.useImperativeHandle(ref, () => ({
        scene: () => null,
        cameraPosition: () => {},
      }));
      return React.createElement("div");
    }),
}));

import ForceGraph3DView from "@/components/ForceGraph3DView";

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
