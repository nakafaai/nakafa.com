import { describe, expect, it } from "@effect/vitest";
import {
  type PageviewWindow,
  startPageviewTracking,
} from "@repo/analytics/posthog/pageview";

function createWindow(href: string) {
  const listeners = new Set<() => void>();
  const history = {
    pushState: vi.fn(),
    replaceState: vi.fn(),
  };
  const source: PageviewWindow = {
    history,
    location: { href },
    addEventListener: (_type: "popstate", listener: () => void) => {
      listeners.add(listener);
    },
  };
  return { history, listeners, source };
}

describe("explicit pageview tracking", () => {
  it("installs tracking without capturing the landing view", () => {
    const { source } = createWindow("https://nakafa.com/en");
    const client = { capture: vi.fn() };

    startPageviewTracking(source, client);

    expect(client.capture).not.toHaveBeenCalled();
  });

  it("captures pushState navigations to a new href", () => {
    const holder = { current: "https://nakafa.com/en" };
    const { history, source } = createWindow(holder.current);
    Object.defineProperty(source, "location", {
      get: () => ({ href: holder.current }),
    });
    const client = { capture: vi.fn() };
    const originalPush = history.pushState;

    startPageviewTracking(source, client);
    holder.current = "https://nakafa.com/id";
    source.history.pushState({}, "", "/id");

    expect(originalPush).toHaveBeenCalledOnce();
    expect(client.capture).toHaveBeenCalledExactlyOnceWith("$pageview");
  });

  it("captures replaceState navigations to a new href", () => {
    const holder = { current: "https://nakafa.com/en" };
    const { source } = createWindow(holder.current);
    Object.defineProperty(source, "location", {
      get: () => ({ href: holder.current }),
    });
    const client = { capture: vi.fn() };

    startPageviewTracking(source, client);
    holder.current = "https://nakafa.com/en/search?q=nakafa";
    source.history.replaceState({}, "", "/en/search?q=nakafa");

    expect(client.capture).toHaveBeenCalledExactlyOnceWith("$pageview");
  });

  it("captures back and forward traversals", () => {
    const holder = { current: "https://nakafa.com/en" };
    const { listeners, source } = createWindow(holder.current);
    Object.defineProperty(source, "location", {
      get: () => ({ href: holder.current }),
    });
    const client = { capture: vi.fn() };

    startPageviewTracking(source, client);
    holder.current = "https://nakafa.com/id";
    for (const listener of listeners) {
      listener();
    }

    expect(client.capture).toHaveBeenCalledExactlyOnceWith("$pageview");
  });

  it("skips same-href replacements without capturing", () => {
    const { source } = createWindow("https://nakafa.com/en");
    const client = { capture: vi.fn() };

    startPageviewTracking(source, client);
    source.history.replaceState({}, "", "/en");
    source.history.pushState({}, "", "/en");

    expect(client.capture).not.toHaveBeenCalled();
  });
});
