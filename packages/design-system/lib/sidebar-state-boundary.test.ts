import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SidebarStatePersistenceError } from "./sidebar-state";
import { runSidebarStateProgram } from "./sidebar-state-boundary";

const { captureExceptionMock } = vi.hoisted(() => ({
  captureExceptionMock: vi.fn(),
}));

vi.mock("@repo/analytics/posthog", () => ({
  captureException: captureExceptionMock,
}));

beforeEach(() => {
  captureExceptionMock.mockClear();
});

describe("sidebar state boundary", () => {
  it("runs successful persistence without reporting an error", () => {
    const persist = vi.fn();

    runSidebarStateProgram(Effect.sync(persist));

    expect(persist).toHaveBeenCalledOnce();
    expect(captureExceptionMock).not.toHaveBeenCalled();
  });

  it("reports and absorbs the typed browser failure", () => {
    const cause = new Error("Cookies are disabled.");

    expect(() =>
      runSidebarStateProgram(
        Effect.fail(
          new SidebarStatePersistenceError({
            cause,
            cookieName: "sidebar_state",
            message: "Failed to persist sidebar state in sidebar_state.",
          })
        )
      )
    ).not.toThrow();
    expect(captureExceptionMock).toHaveBeenCalledExactlyOnceWith(cause, {
      cookie_name: "sidebar_state",
      source: "sidebar-state-persistence",
    });
  });
});
