import { describe, expect, it } from "@effect/vitest";
import {
  PageviewWindow,
  startPageviewTracking,
} from "@repo/analytics/posthog/pageview";
import { Effect, MutableHashSet } from "effect";

function createWindow(href: string) {
  const listeners = MutableHashSet.empty<() => void>();
  const history = {
    pushState: vi.fn(),
    replaceState: vi.fn(),
  };
  const source = {
    history,
    location: { href },
    addEventListener: (_type: "popstate", listener: () => void) => {
      MutableHashSet.add(listeners, listener);
    },
  };
  return { history, listeners, source };
}

describe("explicit pageview tracking", () => {
  it.effect("installs tracking without capturing the landing view", () =>
    Effect.gen(function* () {
      const { source } = createWindow("https://nakafa.com/en");
      const client = { capture: vi.fn() };

      yield* startPageviewTracking(client).pipe(
        Effect.provideService(PageviewWindow, source)
      );

      expect(client.capture).not.toHaveBeenCalled();
    })
  );

  it.effect("captures pushState navigations to a new href", () =>
    Effect.gen(function* () {
      const holder = { current: "https://nakafa.com/en" };
      const { history, source } = createWindow(holder.current);
      Object.defineProperty(source, "location", {
        get: () => ({ href: holder.current }),
      });
      const client = { capture: vi.fn() };
      const originalPush = history.pushState;

      yield* startPageviewTracking(client).pipe(
        Effect.provideService(PageviewWindow, source)
      );
      holder.current = "https://nakafa.com/id";
      source.history.pushState({}, "", "/id");

      expect(originalPush).toHaveBeenCalledOnce();
      expect(client.capture).toHaveBeenCalledExactlyOnceWith("$pageview");
    })
  );

  it.effect("captures replaceState navigations to a new href", () =>
    Effect.gen(function* () {
      const holder = { current: "https://nakafa.com/en" };
      const { source } = createWindow(holder.current);
      Object.defineProperty(source, "location", {
        get: () => ({ href: holder.current }),
      });
      const client = { capture: vi.fn() };

      yield* startPageviewTracking(client).pipe(
        Effect.provideService(PageviewWindow, source)
      );
      holder.current = "https://nakafa.com/en/search?q=nakafa";
      source.history.replaceState({}, "", "/en/search?q=nakafa");

      expect(client.capture).toHaveBeenCalledExactlyOnceWith("$pageview");
    })
  );

  it.effect("captures back and forward traversals", () =>
    Effect.gen(function* () {
      const holder = { current: "https://nakafa.com/en" };
      const { listeners, source } = createWindow(holder.current);
      Object.defineProperty(source, "location", {
        get: () => ({ href: holder.current }),
      });
      const client = { capture: vi.fn() };

      yield* startPageviewTracking(client).pipe(
        Effect.provideService(PageviewWindow, source)
      );
      holder.current = "https://nakafa.com/id";
      for (const listener of listeners) {
        listener();
      }

      expect(client.capture).toHaveBeenCalledExactlyOnceWith("$pageview");
    })
  );

  it.effect("skips same-href replacements without capturing", () =>
    Effect.gen(function* () {
      const { source } = createWindow("https://nakafa.com/en");
      const client = { capture: vi.fn() };

      yield* startPageviewTracking(client).pipe(
        Effect.provideService(PageviewWindow, source)
      );
      source.history.replaceState({}, "", "/en");
      source.history.pushState({}, "", "/en");

      expect(client.capture).not.toHaveBeenCalled();
    })
  );

  it.effect("reports history captures without capturing on install", () =>
    Effect.gen(function* () {
      const holder = { current: "https://nakafa.com/en" };
      const { source } = createWindow(holder.current);
      Object.defineProperty(source, "location", {
        get: () => ({ href: holder.current }),
      });
      const client = { capture: vi.fn() };
      const onHistoryCapture = vi.fn();

      yield* startPageviewTracking(client, onHistoryCapture).pipe(
        Effect.provideService(PageviewWindow, source)
      );
      expect(onHistoryCapture).not.toHaveBeenCalled();

      holder.current = "https://nakafa.com/id";
      source.history.pushState({}, "", "/id");
      expect(onHistoryCapture).toHaveBeenCalledOnce();

      source.history.replaceState({}, "", "/id");
      expect(onHistoryCapture).toHaveBeenCalledOnce();
    })
  );
});
