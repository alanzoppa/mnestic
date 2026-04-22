import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import CalendarPage from "@/app/calendar/page";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/lib/api", () => ({
  getCalendarEvents: vi.fn(),
}));

import { getCalendarEvents } from "@/lib/api";

describe("CalendarPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders events on correct days via memoized indexing", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2024-03-15"));

    (getCalendarEvents as any).mockResolvedValue({
      events: [
        { id: "evt-1", summary: "Event A", date: "2024-03-10", start: "2024-03-10T10:00:00", end: "2024-03-10T11:00:00", location: "", attendees: "" },
        { id: "evt-2", summary: "Event B", date: "2024-03-15", start: "2024-03-15T10:00:00", end: "2024-03-15T11:00:00", location: "", attendees: "" },
        { id: "evt-3", summary: "Event C", date: "2024-03-15", start: "2024-03-15T14:00:00", end: "2024-03-15T15:00:00", location: "", attendees: "" },
      ],
    });

    render(<CalendarPage />);

    await waitFor(() => {
      expect(document.querySelector('[data-testid="calendar-event-evt-1"]')).toBeInTheDocument();
    });

    expect(document.querySelector('[data-testid="calendar-event-evt-2"]')).toBeInTheDocument();
    expect(document.querySelector('[data-testid="calendar-event-evt-3"]')).toBeInTheDocument();
  });
});
