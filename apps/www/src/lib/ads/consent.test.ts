import { afterEach, describe, expect, it } from "@effect/vitest";
import { Array as Arr, Effect, Fiber, Predicate } from "effect";
import { TestClock } from "effect/testing";
import {
  AD_CONSENT_ATTRIBUTE,
  allowsAnalytics,
  CONSENT_OWNER_ATTRIBUTE,
  followConsentMessage,
  startConsentMessage,
  untilGoogleAllowsAnalytics,
} from "@/lib/ads/consent";

/** Runs the consent message's ready callbacks with a TCF API, and returns the listener it registered. */
function readyListener() {
  let listener: (data: unknown, success: boolean) => void = () => undefined;
  window.__tcfapi = (_command, _version, callback) => {
    listener = callback;
  };
  const queue = Reflect.get(window.googlefc ?? {}, "callbackQueue");
  for (const entry of Arr.isArray(queue) ? queue : []) {
    const ready = Predicate.isObject(entry)
      ? Reflect.get(entry, "CONSENT_API_READY")
      : undefined;
    if (Predicate.isFunction(ready)) {
      ready();
    }
  }
  return (data: unknown, success: boolean) => listener(data, success);
}

/** Whether the root carries the mark that hides Nakafa's own prompt. */
function marked() {
  return document.documentElement.hasAttribute(AD_CONSENT_ATTRIBUTE);
}

describe("following Google's consent message", () => {
  afterEach(() => {
    Reflect.deleteProperty(window, "googlefc");
    Reflect.deleteProperty(window, "__tcfapi");
    document.documentElement.removeAttribute(AD_CONSENT_ATTRIBUTE);
  });

  it("marks the root while the message shows and clears it once answered", () => {
    followConsentMessage();
    const listen = readyListener();

    listen({ eventStatus: "cmpuishown" }, true);
    expect(marked()).toBe(true);

    listen({ eventStatus: "useractioncomplete" }, true);
    expect(marked()).toBe(false);
  });

  it("keeps the root unmarked for a failed event or one it cannot read", () => {
    followConsentMessage();
    const listen = readyListener();

    listen({ eventStatus: "cmpuishown" }, false);
    expect(marked()).toBe(false);

    listen({ status: "unknown" }, true);
    expect(marked()).toBe(false);
  });

  it("joins a queue the page already holds and waits where no API exists", () => {
    const earlier = { CONSENT_DATA_READY: () => undefined };
    const queue: object[] = [earlier];
    window.googlefc = { callbackQueue: queue };

    followConsentMessage();

    expect(queue).toHaveLength(2);
    expect(queue[0]).toBe(earlier);
    // A region that needs no message never gives the page the TCF API.
    const ready = Reflect.get(queue[1] ?? {}, "CONSENT_API_READY");
    expect(Predicate.isFunction(ready) ? ready() : "missing").toBeUndefined();
    expect(marked()).toBe(false);
  });
});

/** The prompt the root names for the visitor, if any. */
function owner() {
  return document.documentElement.getAttribute(CONSENT_OWNER_ATTRIBUTE);
}

/** Runs the queued ready callbacks of a region that gives the page no TCF API. */
function readyWithoutApi() {
  const queue = Reflect.get(window.googlefc ?? {}, "callbackQueue");
  for (const entry of Arr.isArray(queue) ? queue : []) {
    const ready = Predicate.isObject(entry)
      ? Reflect.get(entry, "CONSENT_API_READY")
      : undefined;
    if (Predicate.isFunction(ready)) {
      ready();
    }
  }
}

/** A decided TCF event where a privacy law applies, with Google's storage consent or without. */
function decided(granted: boolean) {
  return {
    eventStatus: "useractioncomplete",
    gdprApplies: true,
    purpose: { consents: { 1: granted } },
    vendor: { consents: { 755: granted } },
  } as const;
}

describe("the one prompt a visitor answers", () => {
  afterEach(() => {
    Reflect.deleteProperty(window, "googlefc");
    Reflect.deleteProperty(window, "__tcfapi");
    document.documentElement.removeAttribute(AD_CONSENT_ATTRIBUTE);
    document.documentElement.removeAttribute(CONSENT_OWNER_ATTRIBUTE);
    document.querySelector("#googlefc-script")?.remove();
    document.querySelector('iframe[name="googlefcPresent"]')?.remove();
  });

  it("gives Google's message the visitor where a privacy law applies, and Nakafa's prompt elsewhere", () => {
    followConsentMessage();
    const listen = readyListener();

    listen({ eventStatus: "tcloaded" }, true);
    expect(owner()).toBeNull();

    listen({ eventStatus: "tcloaded", gdprApplies: true }, true);
    expect(owner()).toBe("google");

    listen({ eventStatus: "tcloaded", gdprApplies: false }, true);
    expect(owner()).toBe("nakafa");
  });

  it("lets Google Analytics run only after the visitor gave Google consent to store", () => {
    expect(allowsAnalytics(decided(true))).toBe(true);
    expect(allowsAnalytics(decided(false))).toBe(false);
    expect(
      allowsAnalytics({ ...decided(true), eventStatus: "cmpuishown" })
    ).toBe(false);
    expect(allowsAnalytics({ ...decided(true), gdprApplies: false })).toBe(
      false
    );
    expect(
      allowsAnalytics({ eventStatus: "tcloaded", gdprApplies: true })
    ).toBe(false);
    expect(
      allowsAnalytics({
        eventStatus: "tcloaded",
        gdprApplies: true,
        purpose: { consents: { 1: true } },
      })
    ).toBe(false);
  });

  it.effect(
    "starts the message once and hands a silent one to Nakafa's prompt",
    () =>
      Effect.gen(function* () {
        document.documentElement.setAttribute(
          CONSENT_OWNER_ATTRIBUTE,
          "pending"
        );
        const first = yield* Effect.forkChild(startConsentMessage);
        yield* TestClock.adjust("5 seconds");
        yield* Fiber.join(first);
        expect(owner()).toBe("nakafa");

        document.documentElement.setAttribute(
          CONSENT_OWNER_ATTRIBUTE,
          "google"
        );
        const second = yield* Effect.forkChild(startConsentMessage);
        yield* TestClock.adjust("5 seconds");
        yield* Fiber.join(second);
        expect(owner()).toBe("google");
        expect(document.querySelectorAll("#googlefc-script")).toHaveLength(1);
        expect(
          document.querySelectorAll('iframe[name="googlefcPresent"]')
        ).toHaveLength(1);
      })
  );

  it.effect(
    "lets Google Analytics run at once where Nakafa's prompt governs",
    () =>
      Effect.gen(function* () {
        document.documentElement.setAttribute(
          CONSENT_OWNER_ATTRIBUTE,
          "nakafa"
        );
        yield* untilGoogleAllowsAnalytics;
      })
  );

  it.effect(
    "waits for Google's storage consent, or for Nakafa's prompt to take over",
    () =>
      Effect.gen(function* () {
        let allowed = false;
        const consented = yield* Effect.forkChild(
          untilGoogleAllowsAnalytics.pipe(
            Effect.tap(() =>
              Effect.sync(() => {
                allowed = true;
              })
            )
          )
        );
        yield* Effect.yieldNow;
        const listen = readyListener();
        listen(decided(false), true);
        listen(decided(true), false);
        yield* Effect.yieldNow;
        expect(allowed).toBe(false);
        listen(decided(true), true);
        listen(decided(true), true);
        yield* Fiber.join(consented);

        Reflect.deleteProperty(window, "__tcfapi");
        const handed = yield* Effect.forkChild(untilGoogleAllowsAnalytics);
        yield* Effect.yieldNow;
        readyWithoutApi();
        document.documentElement.setAttribute(
          CONSENT_OWNER_ATTRIBUTE,
          "google"
        );
        document.documentElement.setAttribute(
          CONSENT_OWNER_ATTRIBUTE,
          "nakafa"
        );
        yield* Fiber.join(handed);
      })
  );

  it.effect("stops watching once interrupted", () =>
    Effect.gen(function* () {
      const waiting = yield* Effect.forkChild(untilGoogleAllowsAnalytics);
      yield* Effect.yieldNow;
      yield* Fiber.interrupt(waiting);
      readyListener()(decided(true), true);
      document.documentElement.setAttribute(CONSENT_OWNER_ATTRIBUTE, "nakafa");
      expect(owner()).toBe("nakafa");
    })
  );
});
