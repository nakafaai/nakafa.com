import { MAIN_DOMAIN } from "@repo/site/domains";
import { DateTime, Effect } from "effect";

/** Nakafa's Google Analytics web stream, of property a307729543p433708734. */
export const GOOGLE_ANALYTICS_ID = "G-F0WTB42EQM";

/** Google's library for the stream. */
const SCRIPT_SOURCE = `https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ANALYTICS_ID}`;

/** The id of the one Google Analytics script of a document. */
const SCRIPT_ID = "google-analytics-script";

/** The Google origins that Google Analytics reaches, by policy directive. */
export const GOOGLE_ANALYTICS_POLICY_SOURCES = {
  connect: [
    "https://*.google-analytics.com",
    "https://*.analytics.google.com",
    "https://*.googletagmanager.com",
  ],
  script: ["https://www.googletagmanager.com"],
} as const;

/** The cookies that Google Analytics sets for the stream, which a withdrawal deletes. */
const COOKIES = ["_ga", `_ga_${GOOGLE_ANALYTICS_ID.replace("G-", "")}`];

/**
 * Hands one command to Google Analytics. Its library reads only `arguments`
 * objects from `dataLayer`, never arrays, so this pushes the call's own.
 */
function gtag(..._command: readonly unknown[]) {
  window.dataLayer ??= [];
  window.dataLayer.push(arguments);
}

/**
 * Starts Google Analytics once per document, after the visitor allowed it, in
 * consent mode: every ad signal denied, analytics storage granted, and neither
 * Google signals nor ad personalization, so its data never targets ads. A later
 * start after a withdrawal grants analytics storage again.
 */
export const startGoogleAnalytics = Effect.gen(function* () {
  if (document.querySelector(`#${SCRIPT_ID}`) !== null) {
    gtag("consent", "update", { analytics_storage: "granted" });
    return;
  }
  const now = yield* DateTime.now;
  gtag("consent", "default", {
    ad_personalization: "denied",
    ad_storage: "denied",
    ad_user_data: "denied",
    analytics_storage: "granted",
  });
  gtag("js", DateTime.toDate(now));
  gtag("config", GOOGLE_ANALYTICS_ID, {
    allow_ad_personalization_signals: false,
    allow_google_signals: false,
  });
  const script = document.createElement("script");
  script.async = true;
  script.id = SCRIPT_ID;
  script.src = SCRIPT_SOURCE;
  document.head.append(script);
});

/**
 * Stops Google Analytics after a withdrawal: analytics storage denied where it
 * runs, and its cookies deleted on the site's domain, where Google sets them.
 */
export const stopGoogleAnalytics = Effect.sync(() => {
  if (document.querySelector(`#${SCRIPT_ID}`) !== null) {
    gtag("consent", "update", { analytics_storage: "denied" });
  }
}).pipe(
  Effect.andThen(
    Effect.forEach(COOKIES, (name) =>
      Effect.sync(() => {
        document.cookie = `${name}=; Max-Age=0; Path=/; Domain=.${MAIN_DOMAIN}`;
      })
    )
  ),
  Effect.asVoid
);
