import { afterEach, describe, expect, it } from "@effect/vitest";
import { Array as Arr, Effect, Record as Rec } from "effect";
import { canWarm, readPressableLinks, warmLinks } from "@/lib/routing/warm";

vi.mock("@repo/design-system/lib/settle", async () => {
  const { Effect: Fx } = await import("effect");
  return { untilPageSettled: Fx.void };
});

/** Draws links at the heights given, each a line tall, as the browser would lay them out. */
function drawLinks(links: readonly { href: string; top: number }[]) {
  document.body.replaceChildren(
    ...Arr.map(links, ({ href, top }) => {
      const link = document.createElement("a");
      link.setAttribute("href", href);
      link.getBoundingClientRect = () =>
        DOMRect.fromRect({ height: 20, width: 100, x: 0, y: top });
      link.checkVisibility = () => true;
      return link;
    })
  );
}

/** A router whose matched routes are the page templates that a path names. */
function routerOf(routes: Record<string, string>) {
  const preloadRoute = vi.fn<(options: { href: string }) => Promise<void>>(() =>
    Promise.resolve()
  );
  return {
    preloadRoute,
    router: {
      getMatchedRoutes: (pathname: string) => ({
        foundRoute:
          routes[pathname] === undefined
            ? undefined
            : { fullPath: routes[pathname] },
      }),
      preloadRoute,
      state: { location: { publicHref: "/en" } },
    },
  };
}

describe("warm links", () => {
  afterEach(() => {
    document.body.replaceChildren();
    vi.unstubAllGlobals();
  });

  it("spares a thin connection and one that saves data", () => {
    expect(canWarm(undefined)).toBe(true);
    expect(canWarm({ effectiveType: "4g" })).toBe(true);
    expect(canWarm({})).toBe(true);
    expect(canWarm({ effectiveType: "2g" })).toBe(false);
    expect(canWarm({ effectiveType: "slow-2g" })).toBe(false);
    expect(canWarm({ saveData: true })).toBe(false);
  });

  it("reads each link on screen once, top first, and none off screen", () => {
    drawLinks([
      { href: "/en/a", top: 10 },
      { href: "/en/a", top: 40 },
      { href: "/en/b", top: 80 },
      { href: "/en/above", top: -100 },
      { href: "/en/below", top: 900 },
    ]);
    const hidden = document.createElement("a");
    hidden.setAttribute("href", "/en/hidden");
    hidden.getBoundingClientRect = () =>
      DOMRect.fromRect({ height: 20, width: 100, x: 0, y: 50 });
    hidden.checkVisibility = () => false;
    document.body.append(hidden);

    expect(readPressableLinks(document, 844)).toStrictEqual(["/en/a", "/en/b"]);
  });

  it.effect("warms the build's pages and no other page", () =>
    Effect.gen(function* () {
      drawLinks([
        { href: "/en", top: 0 },
        { href: "/en/pricing", top: 10 },
        { href: "/en/chat", top: 20 },
        { href: "/en/llms.txt", top: 30 },
        { href: "/en/quran/1?x=1", top: 40 },
        { href: "/en/missing", top: 50 },
      ]);
      const { preloadRoute, router } = routerOf({
        "/en": "/$locale",
        "/en/chat": "/$locale/chat",
        "/en/llms.txt": "/$locale/$",
        "/en/pricing": "/$locale/pricing",
        "/en/quran/1": "/$locale/quran/$surah/",
      });

      yield* warmLinks(router);

      expect(
        Arr.map(preloadRoute.mock.calls, ([{ href }]) => href)
      ).toStrictEqual(["/en/pricing", "/en/quran/1?x=1"]);
    })
  );

  it.effect("warms at most six links, and a failed one stays cold", () =>
    Effect.gen(function* () {
      const hrefs = Arr.makeBy(9, (index) => `/en/quran/${index}`);
      drawLinks(Arr.map(hrefs, (href, top) => ({ href, top })));
      const { preloadRoute, router } = routerOf(
        Rec.fromEntries(
          Arr.map(hrefs, (href) => [href, "/$locale/quran/$surah"] as const)
        )
      );
      preloadRoute.mockRejectedValueOnce(new Error("offline"));

      yield* warmLinks(router);

      expect(preloadRoute).toHaveBeenCalledTimes(6);
    })
  );

  it.effect("warms nothing on a connection that saves data", () =>
    Effect.gen(function* () {
      vi.stubGlobal("navigator", { connection: { saveData: true } });
      drawLinks([{ href: "/en/pricing", top: 10 }]);
      const { preloadRoute, router } = routerOf({
        "/en/pricing": "/$locale/pricing",
      });

      yield* warmLinks(router);

      expect(preloadRoute).not.toHaveBeenCalled();
    })
  );
});
