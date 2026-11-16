import { Array as Arr, DateTime, Effect } from "effect";
import { sendsPrivacySignal } from "@/lib/ads/consent";

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

/**
 * Where Google's consent message asks before anything is stored: the European
 * Economic Area, the United Kingdom and Switzerland, by ISO 3166-1 code. Google's
 * certified message updates consent there itself, and only there.
 */
export const CONSENT_FIRST_REGIONS = [
  "AT",
  "BE",
  "BG",
  "CH",
  "CY",
  "CZ",
  "DE",
  "DK",
  "EE",
  "ES",
  "FI",
  "FR",
  "GB",
  "GR",
  "HR",
  "HU",
  "IE",
  "IS",
  "IT",
  "LI",
  "LT",
  "LU",
  "LV",
  "MT",
  "NL",
  "NO",
  "PL",
  "PT",
  "RO",
  "SE",
  "SI",
  "SK",
];

/** How long Google's tags wait for the consent message's answer before they act on the default. */
const CONSENT_WAIT_MILLISECONDS = 500;

/** Every consent type of consent mode denied, analytics storage granted when `analytics` says so. */
function consentWith(analytics: "denied" | "granted") {
  return {
    ad_personalization: "denied",
    ad_storage: "denied",
    ad_user_data: "denied",
    analytics_storage: analytics,
  };
}

/** Google's command queue, started as an array until its library takes it over. */
function commandQueue(): GoogleQueue {
  const queue = window.dataLayer ?? Arr.empty<object>();
  window.dataLayer = queue;
  return queue;
}

/**
 * Hands one command to Google's tag. Its library reads only `arguments`
 * objects from `dataLayer`, never arrays, so this pushes the call's own.
 */
function gtag(..._command: readonly unknown[]) {
  commandQueue().push(arguments);
}

/**
 * Starts Google Analytics once per document, for every visitor, in consent mode
 * (https://developers.google.com/tag-platform/security/guides/consent). Every
 * consent is denied by default where Google's consent message asks first, which
 * then updates it. Elsewhere only analytics storage is granted, so the stream
 * counts visits in aggregate, and not even that when the browser sends Global
 * Privacy Control. The defaults come before the library and any measurement. Ad
 * click identifiers are redacted while ad storage is denied, and neither Google
 * signals nor ad personalization is on, so the stream never targets ads.
 */
export const startGoogleAnalytics = Effect.gen(function* () {
  if (document.querySelector(`#${SCRIPT_ID}`) !== null) {
    return;
  }
  const now = yield* DateTime.now;
  gtag("consent", "default", {
    ...consentWith("denied"),
    region: CONSENT_FIRST_REGIONS,
    wait_for_update: CONSENT_WAIT_MILLISECONDS,
  });
  gtag(
    "consent",
    "default",
    consentWith(sendsPrivacySignal() ? "denied" : "granted")
  );
  gtag("set", "ads_data_redaction", true);
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
