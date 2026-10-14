import { beforeEach, describe, expect, it } from "@effect/vitest";
import {
  ANALYTICS_CONSENT_ACCOUNT_STORAGE_KEY,
  ANALYTICS_CONSENT_NOTICE_VERSION,
  ANONYMOUS_ANALYTICS_CONSENT_STORAGE_KEY,
  createAnonymousAnalyticsConsent,
  encodeAnonymousAnalyticsConsent,
} from "@repo/analytics/consent";
import { Effect } from "effect";
import { ANALYTICS_CONSENT_BOOTSTRAP_SCRIPT } from "@/lib/analytics/consent/bootstrap";

const DECIDED_ATTRIBUTE = "data-analytics-consent";

/** A notice that the consent list still retains but no longer governs. */
const OLDER_NOTICE_VERSION = "privacy-2026-08-21";

/** Runs the page's own inline script and reports the root's decided marker. */
function runBootstrapScript() {
  new Function(ANALYTICS_CONSENT_BOOTSTRAP_SCRIPT)();
  return document.documentElement.getAttribute(DECIDED_ATTRIBUTE);
}

describe("analytics consent bootstrap script", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute(DECIDED_ATTRIBUTE);
  });

  it("leaves the prompt shown and writes nothing when nothing is stored", () => {
    expect(runBootstrapScript()).toBeNull();
    expect(window.localStorage.length).toBe(0);
  });

  it.effect(
    "marks the root for an anonymous decision under the current notice",
    () =>
      Effect.gen(function* () {
        const record = yield* encodeAnonymousAnalyticsConsent(
          createAnonymousAnalyticsConsent("denied", 1)
        );
        window.localStorage.setItem(
          ANONYMOUS_ANALYTICS_CONSENT_STORAGE_KEY,
          record
        );

        expect(runBootstrapScript()).toBe("decided");
      })
  );

  it.effect(
    "keeps the prompt for an anonymous decision under an older notice",
    () =>
      Effect.gen(function* () {
        const record = yield* encodeAnonymousAnalyticsConsent(
          createAnonymousAnalyticsConsent("granted", 1)
        );
        window.localStorage.setItem(
          ANONYMOUS_ANALYTICS_CONSENT_STORAGE_KEY,
          record.replace(ANALYTICS_CONSENT_NOTICE_VERSION, OLDER_NOTICE_VERSION)
        );

        expect(runBootstrapScript()).toBeNull();
      })
  );

  it("keeps the prompt when the stored anonymous record is malformed", () => {
    window.localStorage.setItem(ANONYMOUS_ANALYTICS_CONSENT_STORAGE_KEY, "{");

    expect(runBootstrapScript()).toBeNull();
  });

  it("marks the root for a signed-in choice recorded for the current notice", () => {
    window.localStorage.setItem(
      ANALYTICS_CONSENT_ACCOUNT_STORAGE_KEY,
      ANALYTICS_CONSENT_NOTICE_VERSION
    );

    expect(runBootstrapScript()).toBe("decided");
  });

  it("keeps the prompt for a signed-in choice recorded under an older notice", () => {
    window.localStorage.setItem(
      ANALYTICS_CONSENT_ACCOUNT_STORAGE_KEY,
      OLDER_NOTICE_VERSION
    );

    expect(runBootstrapScript()).toBeNull();
  });
});
