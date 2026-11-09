import { Array as Arr, Option, Schema } from "effect";

/**
 * The root attribute that marks Google's consent message on the screen. Nakafa's
 * own analytics prompt steps aside while it is there, so the two never stand
 * over each other: Google asks about ads, Nakafa about analytics.
 */
export const AD_CONSENT_ATTRIBUTE = "data-ad-consent";

/** The TCF version that Google's consent message speaks. */
const TCF_VERSION = 2.2;

/** One event of the IAB TCF API, read only for whether the message is on the screen. */
const ConsentEvent = Schema.Struct({
  eventStatus: Schema.Literals([
    "tcloaded",
    "cmpuishown",
    "useractioncomplete",
  ]),
});

const decodeConsentEvent = Schema.decodeUnknownOption(ConsentEvent);

/** Marks the root while the message shows, and clears the mark for every other event. */
function followConsentEvent(data: unknown, success: boolean) {
  const shown = Option.exists(
    decodeConsentEvent(data),
    ({ eventStatus }) => success && eventStatus === "cmpuishown"
  );
  document.documentElement.toggleAttribute(AD_CONSENT_ATTRIBUTE, shown);
}

/**
 * Follows Google's consent message once the ad script has started it. The
 * message runs the callbacks of `googlefc.callbackQueue` when its TCF API is
 * ready; a visitor whose region needs no message never reaches that point, and
 * the root keeps no mark.
 */
export function followConsentMessage() {
  consentQueue().push({
    CONSENT_API_READY: () =>
      window.__tcfapi?.("addEventListener", TCF_VERSION, followConsentEvent),
  });
}

/** The consent message's callback queue, started as an array until its script takes it over. */
function consentQueue(): GoogleQueue {
  const consent = window.googlefc ?? {};
  window.googlefc = consent;
  const queue = consent.callbackQueue ?? Arr.empty<object>();
  consent.callbackQueue = queue;
  return queue;
}
