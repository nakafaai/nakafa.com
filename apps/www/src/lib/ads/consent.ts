import { Array as Arr, Effect, MutableRef, Option, Schema } from "effect";
import { AD_CLIENT } from "#www/src/lib/ads/account";

/** The TCF version that Google's consent message speaks. */
const TCF_VERSION = 2.2;

/**
 * The TCF purpose to store and read information on a device. Google's consent
 * message reads its consent as consent mode's analytics storage, so Nakafa's
 * identified analytics follows the same answer.
 */
const STORAGE_PURPOSE = "1";

/** Google's consent message for the account, which runs on pages without ads too. */
const MESSAGE_SOURCE = `https://fundingchoicesmessages.google.com/i/${AD_CLIENT.replace("ca-", "")}?ers=1`;

/** The id of the one consent message script of a document. */
const MESSAGE_ID = "googlefc-script";

/** The frame whose name tells Google's ad script that the message already runs. */
const PRESENT_FRAME = "googlefcPresent";

/** The consents of a TCF event, by purpose id. */
const Consents = Schema.Struct({
  consents: Schema.Record(Schema.String, Schema.Boolean),
});

/** One event of the IAB TCF API, read for the message's state and its consents. */
const ConsentEvent = Schema.Struct({
  eventStatus: Schema.Literals([
    "tcloaded",
    "cmpuishown",
    "useractioncomplete",
  ]),
  gdprApplies: Schema.optionalKey(Schema.Boolean),
  purpose: Schema.optionalKey(Consents),
});

const decodeConsentEvent = Schema.decodeUnknownOption(ConsentEvent);

/**
 * What Google's consent message settled for a visitor: whether it asks them, as
 * it does where a privacy law applies, and whether their identified analytics may
 * run (PostHog's identity and the content-view device identifier). Those need
 * the visitor's consent, which only the message can give, so a visitor it never
 * asks has none.
 */
export const ConsentAnswer = Schema.Struct({
  analytics: Schema.Boolean,
  asks: Schema.Boolean,
});
export type ConsentAnswer = typeof ConsentAnswer.Type;

/** Whether the browser sends Global Privacy Control, which denies every consent. */
export function sendsPrivacySignal() {
  return Reflect.get(navigator, "globalPrivacyControl") === true;
}

/**
 * The answer of a settled TCF event, or none while the message is still on the
 * screen. Identified analytics runs only where the message asks and the visitor
 * consented to storage on the device, and never under Global Privacy Control
 * (`privacySignal`).
 */
export function readConsentAnswer(
  data: unknown,
  success: boolean,
  privacySignal: boolean
): Option.Option<ConsentAnswer> {
  if (!success) {
    return Option.none();
  }
  return Option.flatMap(decodeConsentEvent(data), (event) => {
    if (event.eventStatus === "cmpuishown") {
      return Option.none();
    }
    const asks = event.gdprApplies === true;
    return Option.some({
      analytics:
        asks &&
        !privacySignal &&
        event.purpose?.consents[STORAGE_PURPOSE] === true,
      asks,
    });
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

/**
 * Starts Google's consent message once per document. The hidden frame tells
 * Google's ad script that the message already runs, so it never starts a second.
 */
export const startConsentMessage = Effect.sync(() => {
  if (document.querySelector(`#${MESSAGE_ID}`) !== null) {
    return;
  }
  const frame = document.createElement("iframe");
  frame.name = PRESENT_FRAME;
  frame.hidden = true;
  frame.title = PRESENT_FRAME;
  document.body.append(frame);
  const script = document.createElement("script");
  script.async = true;
  script.id = MESSAGE_ID;
  script.src = MESSAGE_SOURCE;
  document.head.append(script);
});

/** Whether the page already follows the message's answers, so a remounted runtime adds no second listener. */
const following = MutableRef.make(false);

/**
 * Hands each answer of Google's consent message to `follow`: the first once its
 * TCF API is ready, and a new one each time the visitor changes their choices.
 * The message runs `googlefc.callbackQueue` once it is ready. A page follows the
 * answers once.
 */
export function followConsentAnswers(follow: (answer: ConsentAnswer) => void) {
  if (MutableRef.get(following)) {
    return;
  }
  MutableRef.set(following, true);
  consentQueue().push({
    CONSENT_API_READY: () =>
      window.__tcfapi?.("addEventListener", TCF_VERSION, (data, success) =>
        Option.map(
          readConsentAnswer(data, success, sendsPrivacySignal()),
          follow
        )
      ),
  });
}

/** Shows Google's message again, where the visitor changes or withdraws their choices. */
export function showConsentChoices() {
  consentQueue().push({
    CONSENT_API_READY: () => window.googlefc?.showRevocationMessage?.(),
  });
}
