import { afterEach, describe, expect, it } from "@effect/vitest";
import { GOING_ATTRIBUTE } from "@repo/design-system/lib/lazy";
import { askBeforeLosingRequests, readConvexClient } from "@/lib/convex/client";

const URL = "https://example.convex.cloud";

/** Lets the page go, and says whether something asked the reader first. */
function leave() {
  const event = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
}

/** Holds a request of the page's client in flight, or none. */
function inFlight(held: boolean) {
  const client = readConvexClient(URL);
  vi.spyOn(client, "connectionState").mockReturnValue({
    ...client.connectionState(),
    hasInflightRequests: held,
  });
}

describe("browser Convex client", () => {
  afterEach(() => {
    document.documentElement.removeAttribute(GOING_ATTRIBUTE);
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("creates one client per page", () => {
    expect(readConvexClient(URL)).toBe(readConvexClient(URL));
  });

  it("asks before the page goes while a request has no answer", () => {
    inFlight(true);

    expect(leave()).toBe(true);
  });

  it("lets the page go with nothing in flight", () => {
    inFlight(false);

    expect(leave()).toBe(false);
  });

  it("never stops a reload for a chunk of an earlier deploy", () => {
    inFlight(true);
    document.documentElement.setAttribute(GOING_ATTRIBUTE, "reload");

    expect(leave()).toBe(false);
  });

  it("asks a reader who leaves with a request in flight", () => {
    const event = { preventDefault: vi.fn() };
    document.documentElement.setAttribute(GOING_ATTRIBUTE, "leave");

    askBeforeLosingRequests(
      {
        connectionState: () => ({
          ...readConvexClient(URL).connectionState(),
          hasInflightRequests: true,
        }),
      },
      event
    );

    expect(event.preventDefault).toHaveBeenCalledOnce();
  });

  it("adds no warning during server rendering, where no window exists", async () => {
    vi.stubGlobal("window", undefined);
    vi.resetModules();
    const server = await import("@/lib/convex/client");

    expect(server.readConvexClient(URL)).toBe(server.readConvexClient(URL));
  });
});
