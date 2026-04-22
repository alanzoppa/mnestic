import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { AreaChartComponent } from "@/components/charts/LineCharts";

const mockCalls: string[] = [];

vi.mock("recharts", () => {
  const make = (name: string) => {
    const Comp = (props: any) => {
      mockCalls.push(name);
      return <div data-testid={name}>{props.children ?? name}</div>;
    };
    Comp.displayName = name;
    return Comp;
  };
  return {
    AreaChart: make("AreaChart"),
    Area: make("Area"),
    LineChart: make("LineChart"),
    Line: make("Line"),
    XAxis: make("XAxis"),
    YAxis: make("YAxis"),
    CartesianGrid: make("CartesianGrid"),
    Tooltip: make("Tooltip"),
    Legend: make("Legend"),
    ResponsiveContainer: make("ResponsiveContainer"),
  };
});

describe("AreaChartComponent", () => {
  it("renders AreaChart & Area, not LineChart & Line (regression: #8)", () => {
    mockCalls.length = 0;
    render(
      <AreaChartComponent
        data={[{ label: "A", value: 10 }, { label: "B", value: 20 }]}
        lines={[{ key: "value", name: "Value", color: "#3b82f6" }]}
      />
    );
    expect(mockCalls).toContain("AreaChart");
    expect(mockCalls).toContain("Area");
    expect(mockCalls).not.toContain("LineChart");
    expect(mockCalls).not.toContain("Line");
  });
});
