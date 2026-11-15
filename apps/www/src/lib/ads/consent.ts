import { Array as Arr, Duration, Effect, Option, Schema } from "effect";
import { AD_CLIENT } from "@/lib/ads/account";

/**
 * The root attribute that marks Google's consent message on the screen. Nakafa's
 * own analytics prompt steps aside while it is there, so the two never stand
 * over each other: Google asks about ads, Nakafa about analytics.
 */
export const AD_CONSENT_ATTRIBUTE = "data-ad-consent";

/**
 * The root attribute that names the one consent prompt a visitor answers, so no
 * visitor gets two, one after the other. The inline script writes `pending` before
 * paint on production, where Google's consent message runs on every page. The page
 * writes `google` once that message reports that a privacy law applies, which keeps
 * Nakafa's prompt hidden for good, and `nakafa` once it reports that none applies
 * or stays silent, as under an ad blocker, which shows Nakafa's prompt as before.
 * Any other host never carries it.
 */
export const CONSENT_OWNER_ATTRIBUTE = "data-consent-owner";

/** The prompt that a visitor answers, as the root names it. */
const ConsentOwner = Schema.Literals(["pending", "google", "nakafa"]);

/** The TCF version that Google's consent message speaks. */
const TCF_VERSION = 2.2;

/** Google's id in the IAB Global Vendor List. */
const GOOGLE_VENDOR = "755";

/** The TCF purpose to store and read information on a device. */
const STORAGE_PURPOSE = "1";

/** How long Google's consent message may stay silent before Nakafa's own prompt shows. */
const MESSAGE_PATIENCE = Duration.seconds(5);

/** Google's consent message for the account, which runs on pages without ads too. */
const MESSAGE_SOURCE = `https://fundingchoicesmessages.google.com/i/${AD_CLIENT.replace("ca-", "")}?ers=1`;

/** The id of the one consent message script of a document. */
const MESSAGE_ID = "googlefc-script";

/** The frame whose name tells Google's ad script that the message already runs. */
const PRESENT_FRAME = "googlefcPresent";

/** The consents of a TCF event, by purpose or vendor id. */
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
  vendor: Schema.optionalKey(Consents),
});

const decodeConsentEvent = Schema.decodeUnknownOption(ConsentEvent);

/** Reads one TCF callback: an event only when the API reports success. */
function readConsentEvent(data: unknown, success: boolean) {
  return success ? decodeConsentEvent(data) : Option.none();
}

/**
 * Whether a TCF event lets Google Analytics store its cookies where a privacy law
 * applies: the visitor has answered, and gave Google consent to store and read
 * information on the device.
 */
export function allowsAnalytics(event: typeof ConsentEvent.Type) {
  return (
    event.eventStatus !== "cmpuishown" &&
    event.gdprApplies === true &&
    event.purpose?.consents[STORAGE_PURPOSE] === true &&
    event.vendor?.consents[GOOGLE_VENDOR] === true
  );
}

/** Marks the root while the message shows, and records which prompt the visitor answers. */
function followConsentEvent(data: unknown, success: boolean) {
  const event = readConsentEvent(data, success);
  const shown = Option.exists(
    event,
    ({ eventStatus }) => eventStatus === "cmpuishown"
  );
  const root = document.documentElement;
  root.toggleAttribute(AD_CONSENT_ATTRIBUTE, shown);
  Option.map(
    Option.flatMap(event, ({ gdprApplies }) =>
      Option.fromNullishOr(gdprApplies)
    ),
    (applies) =>
      root.setAttribute(CONSENT_OWNER_ATTRIBUTE, applies ? "google" : "nakafa")
  );
}

/**
 * Follows Google's consent message once a script has started it. The message runs
 * the callbacks of `googlefc.callbackQueue` when its TCF API is ready; a visitor
 * whose region needs no message reaches that point with `gdprApplies` false.
 */
export function followConsentMessage() {
  consentQueue().push({
    CONSENT_API_READY: () =>
      window.__tcfapi?.("addEventListener", TCF_VERSION, followConsentEvent),
  });
}

/** Adds Google's consent message and its presence frame to the document once. */
function appendConsentMessage() {
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
  followConsentMessage();
}

/**
 * Starts Google's consent message on a page, once per document, and hands the
 * visitor to Nakafa's own prompt when the message has not answered after
 * `MESSAGE_PATIENCE`, as when an ad blocker stops it. A later start waits again,
 * so an interrupted wait never leaves the prompt hidden.
 */
export const startConsentMessage = Effect.sync(appendConsentMessage).pipe(
  Effect.andThen(Effect.sleep(MESSAGE_PATIENCE)),
  Effect.andThen(
    Effect.sync(() => {
      const root = document.documentElement;
      const owner = Schema.decodeUnknownOption(ConsentOwner)(
        root.getAttribute(CONSENT_OWNER_ATTRIBUTE)
      );
      if (Option.exists(owner, (value) => value === "pending")) {
        root.setAttribute(CONSENT_OWNER_ATTRIBUTE, "nakafa");
      }
    })
  )
);

/**
 * Completes once Google's consent message lets Google Analytics run: as soon as
 * Nakafa's own prompt governs the visitor, and where a privacy law applies once
 * the visitor gave Google consent to store information on the device. It waits
 * while neither holds, and stops watching when interrupted.
 */
export const untilGoogleAllowsAnalytics = Effect.callback<void>((resume) => {
  const root = document.documentElement;
  let finished = false;
  const finish = () => {
    if (finished) {
      return;
    }
    finished = true;
    watcher.disconnect();
    resume(Effect.void);
  };
  const check = () => {
    if (root.getAttribute(CONSENT_OWNER_ATTRIBUTE) === "nakafa") {
      finish();
    }
  };
  const watcher = new MutationObserver(check);
  watcher.observe(root, { attributeFilter: [CONSENT_OWNER_ATTRIBUTE] });
  consentQueue().push({
    CONSENT_API_READY: () =>
      window.__tcfapi?.("addEventListener", TCF_VERSION, (data, success) => {
        if (Option.exists(readConsentEvent(data, success), allowsAnalytics)) {
          finish();
        }
      }),
  });
  check();
  return Effect.sync(() => {
    finished = true;
    watcher.disconnect();
  });
});

/** The consent message's callback queue, started as an array until its script takes it over. */
function consentQueue(): GoogleQueue {
  const consent = window.googlefc ?? {};
  window.googlefc = consent;
  const queue = consent.callbackQueue ?? Arr.empty<object>();
  consent.callbackQueue = queue;
  return queue;
}
