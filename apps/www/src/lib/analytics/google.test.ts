import { afterEach, describe, expect, it } from "@effect/vitest";
import { Array as Arr, Effect, Option } from "effect";
import {
  GOOGLE_ANALYTICS_ID,
  startGoogleAnalytics,
  stopGoogleAnalytics,
} from "@/lib/analytics/google";

/** The commands handed to Google Analytics, each as the list of its arguments. */
function commands() {
  return Arr.map(window.dataLayer ?? [], (entry) => Arr.fromIterable(entry));
}

/** The Google Analytics scripts of the document. */
function scripts() {
  return document.querySelectorAll(
    `script[src="https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ANALYTICS_ID}"]`
  );
}

describe("Google Analytics", () => {
  afterEach(() => {
    Reflect.deleteProperty(window, "dataLayer");
    document.querySelector("#google-analytics-script")?.remove();
    vi.restoreAllMocks();
  });

  it.effect("starts once in consent mode with every ad signal denied", () =>
    Effect.gen(function* () {
      yield* startGoogleAnalytics;
      yield* startGoogleAnalytics;

      expect(scripts()).toHaveLength(1);
      expect(commands()).toEqual([
        [
          "consent",
          "default",
          {
            ad_personalization: "denied",
            ad_storage: "denied",
            ad_user_data: "denied",
            analytics_storage: "granted",
          },
        ],
        ["js", expect.any(Date)],
        [
          "config",
          GOOGLE_ANALYTICS_ID,
          {
            allow_ad_personalization_signals: false,
            allow_google_signals: false,
          },
        ],
        ["consent", "update", { analytics_storage: "granted" }],
      ]);
      // gtag.js reads only arguments objects from its queue, never arrays.
      expect(Object.prototype.toString.call(window.dataLayer?.[0])).toBe(
        "[object Arguments]"
      );
    })
  );

  it.effect(
    "denies analytics storage and deletes its cookies after a withdrawal",
    () =>
      Effect.gen(function* () {
        const written = vi.spyOn(document, "cookie", "set");
        yield* startGoogleAnalytics;
        yield* stopGoogleAnalytics;

        expect(Option.getOrUndefined(Arr.last(commands()))).toEqual([
          "consent",
          "update",
          { analytics_storage: "denied" },
        ]);
        expect(written.mock.calls).toEqual([
          ["_ga=; Max-Age=0; Path=/; Domain=.nakafa.com"],
          ["_ga_F0WTB42EQM=; Max-Age=0; Path=/; Domain=.nakafa.com"],
        ]);
      })
  );

  it.effect(
    "deletes the cookies of an earlier visit without starting anything",
    () =>
      Effect.gen(function* () {
        const written = vi.spyOn(document, "cookie", "set");
        yield* stopGoogleAnalytics;

        expect(window.dataLayer).toBeUndefined();
        expect(written).toHaveBeenCalledTimes(2);
      })
  );
});
