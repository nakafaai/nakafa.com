import { afterEach, describe, expect, it } from "@effect/vitest";
import { Array as Arr, Effect, Predicate } from "effect";
import {
  CONSENT_FIRST_REGIONS,
  GOOGLE_ANALYTICS_ID,
  startGoogleAnalytics,
} from "@/lib/analytics/google";

/** The queue as the page fills it before Google's library takes it over: each call's own arguments. */
function queued(): readonly unknown[] {
  const queue: unknown = window.dataLayer;
  return Arr.isArray(queue) ? queue : [];
}

/** The commands handed to Google's tag, each as the list of its arguments. */
function commands() {
  return Arr.map(queued(), (entry) =>
    Predicate.isIterable(entry) ? Arr.fromIterable(entry) : [entry]
  );
}

/** The Google Analytics scripts of the document. */
function scripts() {
  return document.querySelectorAll(
    `script[src="https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ANALYTICS_ID}"]`
  );
}

/** Every consent type of consent mode denied, analytics storage as `analytics` says. */
function consentWith(analytics: "denied" | "granted") {
  return {
    ad_personalization: "denied",
    ad_storage: "denied",
    ad_user_data: "denied",
    analytics_storage: analytics,
  };
}

describe("Google Analytics", () => {
  afterEach(() => {
    Reflect.deleteProperty(window, "dataLayer");
    Reflect.deleteProperty(navigator, "globalPrivacyControl");
    document.querySelector("#google-analytics-script")?.remove();
  });

  it.effect(
    "starts once, its consent defaults before its library: all denied where Google's message asks first, only analytics storage granted elsewhere",
    () =>
      Effect.gen(function* () {
        yield* startGoogleAnalytics;
        yield* startGoogleAnalytics;

        expect(scripts()).toHaveLength(1);
        expect(commands()).toEqual([
          [
            "consent",
            "default",
            {
              ...consentWith("denied"),
              region: CONSENT_FIRST_REGIONS,
              wait_for_update: 500,
            },
          ],
          ["consent", "default", consentWith("granted")],
          ["set", "ads_data_redaction", true],
          ["js", expect.any(Date)],
          [
            "config",
            GOOGLE_ANALYTICS_ID,
            {
              allow_ad_personalization_signals: false,
              allow_google_signals: false,
            },
          ],
        ]);
        // gtag.js reads only arguments objects from its queue, never arrays.
        expect(Object.prototype.toString.call(queued()[0])).toBe(
          "[object Arguments]"
        );
      })
  );

  it.effect(
    "denies every consent by default for a browser that sends Global Privacy Control",
    () =>
      Effect.gen(function* () {
        Object.defineProperty(navigator, "globalPrivacyControl", {
          configurable: true,
          value: true,
        });

        yield* startGoogleAnalytics;

        expect(commands()[1]).toEqual([
          "consent",
          "default",
          consentWith("denied"),
        ]);
      })
  );

  it("asks first in the European Economic Area, the United Kingdom and Switzerland", () => {
    expect(CONSENT_FIRST_REGIONS).toHaveLength(32);
    expect(CONSENT_FIRST_REGIONS).toEqual(
      expect.arrayContaining(["DE", "FR", "GB", "CH", "NO", "IS", "LI"])
    );
    expect(CONSENT_FIRST_REGIONS).not.toContain("ID");
  });
});
