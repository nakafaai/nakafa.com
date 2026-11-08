import { afterEach, describe, expect, it } from "@effect/vitest";
import { Effect, Exit, Fiber } from "effect";
import {
  AD_SCRIPT_SOURCE,
  isAdTest,
  loadAdScript,
  requestAd,
  untilUnfilled,
} from "@/lib/ads/script";

/** The one ad script the document holds. */
function adScript() {
  const script = document.querySelector("#adsbygoogle-script");
  expect(script).toBeInstanceOf(HTMLScriptElement);
  return script instanceof HTMLScriptElement
    ? script
    : document.createElement("script");
}

describe("loading the ad script", () => {
  afterEach(() => {
    document.head.replaceChildren();
    Reflect.deleteProperty(window, "adsbygoogle");
    Reflect.deleteProperty(window, "googlefc");
  });

  it.effect(
    "adds the account's script once, for non-personalized ads, and follows the consent message",
    () =>
      Effect.gen(function* () {
        const first = yield* Effect.forkChild(loadAdScript);
        const second = yield* Effect.forkChild(loadAdScript);
        yield* Effect.yieldNow;

        const script = adScript();
        expect(script.src).toBe(AD_SCRIPT_SOURCE);
        expect(script.async).toBe(true);
        expect(script.crossOrigin).toBe("anonymous");
        expect(document.head.querySelectorAll("script")).toHaveLength(1);
        expect(window.googlefc?.callbackQueue).toHaveLength(1);
        expect(window.adsbygoogle?.requestNonPersonalizedAds).toBe(1);

        script.dispatchEvent(new Event("load"));
        yield* Fiber.join(first);
        yield* Fiber.join(second);
        expect(script.getAttribute("data-outcome")).toBe("loaded");
      })
  );

  it.effect("answers a later frame at once from the recorded load", () =>
    Effect.gen(function* () {
      const waiting = yield* Effect.forkChild(loadAdScript);
      yield* Effect.yieldNow;
      adScript().dispatchEvent(new Event("load"));
      yield* Fiber.join(waiting);

      yield* loadAdScript;
      expect(document.head.querySelectorAll("script")).toHaveLength(1);
    })
  );

  it.effect("fails every waiter when the script cannot load", () =>
    Effect.gen(function* () {
      const waiting = yield* Effect.forkChild(Effect.flip(loadAdScript));
      yield* Effect.yieldNow;
      adScript().dispatchEvent(new Event("error"));

      expect(yield* Fiber.join(waiting)).toMatchObject({
        _tag: "AdScriptFailed",
      });
      expect(yield* Effect.flip(loadAdScript)).toMatchObject({
        _tag: "AdScriptFailed",
      });
    })
  );

  it.effect("stops listening when a frame leaves before the load ends", () =>
    Effect.gen(function* () {
      const waiting = yield* Effect.forkChild(loadAdScript);
      yield* Effect.yieldNow;
      const script = adScript();
      const removed = vi.spyOn(script, "removeEventListener");

      yield* Fiber.interrupt(waiting);

      expect(removed).toHaveBeenCalledWith("load", expect.any(Function));
      expect(removed).toHaveBeenCalledWith("error", expect.any(Function));
      expect(Exit.hasInterrupts(yield* Fiber.await(waiting))).toBe(true);
    })
  );
});

describe("asking for a unit's ad", () => {
  afterEach(() => {
    Reflect.deleteProperty(window, "adsbygoogle");
  });

  it.effect("pushes to the ad queue once per unit", () =>
    Effect.gen(function* () {
      const unit = document.createElement("ins");

      yield* requestAd(unit);
      yield* requestAd(unit);

      expect(window.adsbygoogle).toEqual([{}]);
      expect(unit.hasAttribute("data-ad-asked")).toBe(true);
      // The test document is not on the production host, so it asks for a test ad.
      expect(unit.getAttribute("data-adtest")).toBe("on");
    })
  );

  it.effect("joins the queue the script already holds", () =>
    Effect.gen(function* () {
      const queue = [{}];
      window.adsbygoogle = queue;

      yield* requestAd(document.createElement("ins"));

      expect(window.adsbygoogle).toBe(queue);
      expect(queue).toHaveLength(2);
    })
  );
});

describe("waiting for AdSense to answer that it has no ad", () => {
  it.effect("completes once the unit is marked unfilled, not filled", () =>
    Effect.gen(function* () {
      const unit = document.createElement("ins");
      const waiting = yield* Effect.forkChild(untilUnfilled(unit));

      unit.setAttribute("data-ad-status", "filled");
      yield* Effect.promise(() => Promise.resolve());
      expect(waiting.pollUnsafe()).toBeUndefined();

      unit.setAttribute("data-ad-status", "unfilled");
      yield* Fiber.join(waiting);
    })
  );

  it.effect("stops watching the unit when its frame leaves first", () =>
    Effect.gen(function* () {
      const unit = document.createElement("ins");
      const waiting = yield* Effect.forkChild(untilUnfilled(unit));
      yield* Effect.yieldNow;

      yield* Fiber.interrupt(waiting);
      unit.setAttribute("data-ad-status", "unfilled");
      yield* Effect.promise(() => Promise.resolve());

      expect(Exit.hasInterrupts(yield* Fiber.await(waiting))).toBe(true);
    })
  );

  it.effect("completes at once for a unit already marked unfilled", () => {
    const unit = document.createElement("ins");
    unit.setAttribute("data-ad-status", "unfilled");
    return untilUnfilled(unit);
  });
});

describe("test ads", () => {
  it("asks for test ads everywhere but the production host", () => {
    expect(isAdTest("nakafa.com")).toBe(false);
    expect(isAdTest("staging.nakafa.com")).toBe(true);
    expect(isAdTest("localhost")).toBe(true);
  });
});
