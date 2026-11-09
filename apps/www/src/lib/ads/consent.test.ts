import { afterEach, describe, expect, it } from "@effect/vitest";
import { Array as Arr, Predicate } from "effect";
import { AD_CONSENT_ATTRIBUTE, followConsentMessage } from "@/lib/ads/consent";

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
