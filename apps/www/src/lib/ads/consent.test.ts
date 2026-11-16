import { afterEach, describe, expect, it } from "@effect/vitest";
import { Array as Arr, Effect, MutableList, Option, Predicate } from "effect";
import { readConsentAnswer, sendsPrivacySignal } from "@/lib/ads/consent";

/** A fresh copy of the module, whose page-wide state starts over. */
async function freshConsent() {
  vi.resetModules();
  return await import("@/lib/ads/consent");
}

/** Runs the callbacks queued for the message once its TCF API is ready, and returns its listener. */
function readyMessage() {
  const listeners =
    MutableList.make<(data: unknown, success: boolean) => void>();
  window.__tcfapi = (_command, _version, callback) => {
    MutableList.append(listeners, callback);
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
  return {
    listeners,
    send: (data: unknown, success = true) => {
      for (const listener of MutableList.toArray(listeners)) {
        listener(data, success);
      }
    },
  };
}

/** A settled TCF event, with its storage purpose's consent. */
function settled(gdprApplies: boolean, storage?: boolean) {
  return {
    eventStatus: "useractioncomplete",
    gdprApplies,
    ...(storage === undefined ? {} : { purpose: { consents: { 1: storage } } }),
  };
}

afterEach(() => {
  Reflect.deleteProperty(window, "googlefc");
  Reflect.deleteProperty(window, "__tcfapi");
  document.head.replaceChildren();
  document.body.replaceChildren();
});

describe("reading an answer of Google's consent message", () => {
  it("runs identified analytics only where the message asks and the visitor consented to storage", () => {
    expect(readConsentAnswer(settled(true, true), true, false)).toEqual(
      Option.some({ analytics: true, asks: true })
    );
    expect(readConsentAnswer(settled(true, false), true, false)).toEqual(
      Option.some({ analytics: false, asks: true })
    );
    expect(readConsentAnswer(settled(true), true, false)).toEqual(
      Option.some({ analytics: false, asks: true })
    );
  });

  it("runs no identified analytics for a visitor the message never asks", () => {
    expect(readConsentAnswer(settled(false), true, false)).toEqual(
      Option.some({ analytics: false, asks: false })
    );
    expect(
      readConsentAnswer(
        { eventStatus: "tcloaded", gdprApplies: false },
        true,
        false
      )
    ).toEqual(Option.some({ analytics: false, asks: false }));
  });

  it("runs no identified analytics under Global Privacy Control, whatever the visitor chose", () => {
    expect(readConsentAnswer(settled(true, true), true, true)).toEqual(
      Option.some({ analytics: false, asks: true })
    );
  });

  it("reads nothing while the message shows, from a failed event, or from one it cannot read", () => {
    expect(
      readConsentAnswer(
        { eventStatus: "cmpuishown", gdprApplies: true },
        true,
        false
      )
    ).toEqual(Option.none());
    expect(readConsentAnswer(settled(true, true), false, false)).toEqual(
      Option.none()
    );
    expect(readConsentAnswer({ eventStatus: "unknown" }, true, false)).toEqual(
      Option.none()
    );
  });
});

describe("Google's consent message", () => {
  it.effect(
    "starts once, beside the frame that tells the ad script it runs",
    () =>
      Effect.gen(function* () {
        const { startConsentMessage } = yield* Effect.promise(freshConsent);

        yield* startConsentMessage;
        yield* startConsentMessage;

        expect(document.querySelectorAll("#googlefc-script")).toHaveLength(1);
        expect(
          document.querySelector<HTMLScriptElement>("#googlefc-script")?.src
        ).toContain("https://fundingchoicesmessages.google.com/i/");
        const frame = document.querySelector("iframe");
        expect(frame?.name).toBe("googlefcPresent");
        expect(frame?.hidden).toBe(true);
      })
  );

  it("hands every settled answer to the page once its API is ready, through one listener", async () => {
    const { followConsentAnswers } = await freshConsent();
    const answers = MutableList.make<unknown>();

    followConsentAnswers((answer) => MutableList.append(answers, answer));
    followConsentAnswers((answer) => MutableList.append(answers, answer));
    const message = readyMessage();
    message.send({ eventStatus: "cmpuishown", gdprApplies: true });
    message.send(settled(true, false));
    message.send(settled(true, true));

    expect(MutableList.toArray(message.listeners)).toHaveLength(1);
    expect(MutableList.toArray(answers)).toEqual([
      { analytics: false, asks: true },
      { analytics: true, asks: true },
    ]);
  });

  it("reads Global Privacy Control from the browser", () => {
    expect(sendsPrivacySignal()).toBe(false);
    Object.defineProperty(navigator, "globalPrivacyControl", {
      configurable: true,
      value: true,
    });
    expect(sendsPrivacySignal()).toBe(true);
    Reflect.deleteProperty(navigator, "globalPrivacyControl");
  });

  it("waits without an API, as under an ad blocker", async () => {
    const { followConsentAnswers } = await freshConsent();
    const answers = MutableList.make<unknown>();

    followConsentAnswers((answer) => MutableList.append(answers, answer));
    const queue = Reflect.get(window.googlefc ?? {}, "callbackQueue");
    const [entry] = Arr.isArray(queue) ? queue : [];
    const ready = Predicate.isObject(entry)
      ? Reflect.get(entry, "CONSENT_API_READY")
      : undefined;
    expect(Predicate.isFunction(ready)).toBe(true);
    if (Predicate.isFunction(ready)) {
      ready();
    }

    expect(MutableList.toArray(answers)).toEqual([]);
  });

  it("shows the message again once it is ready, where the visitor changes their choices", async () => {
    const { showConsentChoices } = await freshConsent();
    const showRevocationMessage = vi.fn();

    showConsentChoices();
    window.googlefc = { ...window.googlefc, showRevocationMessage };
    readyMessage();

    expect(showRevocationMessage).toHaveBeenCalledOnce();
  });
});
