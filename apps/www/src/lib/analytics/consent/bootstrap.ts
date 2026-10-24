import {
  ANALYTICS_BROWSER_SIGNAL_MECHANISM,
  ANALYTICS_CONSENT_CATEGORY,
  ANALYTICS_CONSENT_DENIED,
  ANALYTICS_CONSENT_GRANTED,
  ANALYTICS_CONSENT_MECHANISM,
  ANALYTICS_CONSENT_NOTICE_VERSION,
  ANALYTICS_CONSENT_ROOT_ATTRIBUTE,
  ANONYMOUS_ANALYTICS_CONSENT_STORAGE_KEY,
  CONSENT_NOTICE_VERSIONS,
} from "@repo/analytics/consent";
import { Effect, Option, Schema } from "effect";
import { reportClientException } from "@/lib/analytics/client";
import type { BrowserPrivacySignal } from "@/lib/analytics/consent/signal";
import { KNOWN_SESSION_KEY } from "@/lib/auth/keys";

/** The literals the decision compares against, named as the consent store names them. */
const BootstrapVocabularySchema = Schema.Struct({
  category: Schema.String,
  decisions: Schema.Struct({ denied: Schema.String, granted: Schema.String }),
  mechanisms: Schema.Struct({
    browserSignal: Schema.String,
    privacyControls: Schema.String,
  }),
  noticeVersions: Schema.Array(Schema.String),
});

type BootstrapVocabulary = typeof BootstrapVocabularySchema.Type;

/** The literals of the consent store, passed into the decision as data. */
export const ANALYTICS_CONSENT_BOOTSTRAP_VOCABULARY: BootstrapVocabulary = {
  category: ANALYTICS_CONSENT_CATEGORY,
  decisions: {
    denied: ANALYTICS_CONSENT_DENIED,
    granted: ANALYTICS_CONSENT_GRANTED,
  },
  mechanisms: {
    browserSignal: ANALYTICS_BROWSER_SIGNAL_MECHANISM,
    privacyControls: ANALYTICS_CONSENT_MECHANISM,
  },
  noticeVersions: CONSENT_NOTICE_VERSIONS,
};

const JsonStringSchema = Schema.fromJsonString(Schema.String);

/** Writes one constant as a JavaScript string literal inside the script. */
const literal = (value: string) => Schema.encodeSync(JsonStringSchema)(value);

/** Writes the vocabulary as a JavaScript object literal inside the script. */
const vocabularyLiteral = (vocabulary: BootstrapVocabulary) =>
  Schema.encodeSync(Schema.fromJsonString(BootstrapVocabularySchema))(
    vocabulary
  );

/**
 * The page's reader of one stored JSON text, written into the script as source.
 * An unreadable text, or a value that is not an object, reads as undefined.
 */
export const READ_RECORD_SCRIPT = `function (text) {
  var value;
  try {
    value = JSON.parse(text);
  } catch (error) {
    return undefined;
  }
  return value !== null && typeof value === "object" ? value : undefined;
}`;

const StoredRecordSchema = Schema.fromJsonString(
  Schema.Record(Schema.String, Schema.Unknown)
);

/** The reader of a page that the server did not render with the script: the same answer. */
const readStoredRecord = (text: string) =>
  Option.getOrUndefined(Schema.decodeOption(StoredRecordSchema)(text));

/**
 * Resolves the mark the page writes on the document root before paint, from the raw
 * values this browser holds. It is "decided" when a browser privacy signal is set,
 * or when the stored anonymous record decides: a denial under any notice, and a
 * grant under the current notice only. It is "pending" while a session is known,
 * whether it is signed in or a sign-in is on its way, because the store waits for
 * Better Auth, Convex, and the account's choice before it knows the status. It is
 * null when the prompt may show.
 *
 * The inline script is built from this function's source text, so it refers to
 * nothing outside its body: every value arrives as an argument, and so does the
 * reader that turns a stored text into a record. The script passes JSON parsing,
 * and the client passes a Schema reader. This runs before any import, the same
 * exception AGENTS.md names for code that Playwright serializes into the page.
 */
export function resolveAnalyticsConsentMark({
  anonymousRecord,
  doNotTrack,
  globalPrivacyControl,
  knownSession,
  noticeVersion,
  readRecord,
  vocabulary,
}: {
  readonly anonymousRecord: string | null;
  readonly doNotTrack: string | null | undefined;
  readonly globalPrivacyControl: unknown;
  readonly knownSession: string | null;
  readonly noticeVersion: string;
  readonly readRecord: (
    text: string
  ) => Readonly<Record<string, unknown>> | undefined;
  readonly vocabulary: BootstrapVocabulary;
}): "decided" | "pending" | null {
  // A browser privacy signal is a decision of its own, as the store reads it.
  if (
    globalPrivacyControl === true ||
    doNotTrack === "1" ||
    doNotTrack === "yes"
  ) {
    return "decided";
  }

  // A known session holds the prompt until the store knows the account's choice,
  // since the first paint cannot read that choice. A sign-in on its way is a known
  // session too, because the browser has no id for it yet.
  if (knownSession !== null) {
    return "pending";
  }

  // Without a known session, the anonymous record decides under the same rule: a
  // denial under any notice, and a grant under the current notice only.
  const record =
    anonymousRecord === null ? undefined : readRecord(anonymousRecord);
  let isKnownNotice = false;
  for (const version of vocabulary.noticeVersions) {
    isKnownNotice ||= version === record?.noticeVersion;
  }
  const decidedAt = record?.decidedAt;
  const isDenied = record?.decision === vocabulary.decisions.denied;
  const isGranted = record?.decision === vocabulary.decisions.granted;
  const hasPrivacyControls =
    record?.mechanism === vocabulary.mechanisms.privacyControls;
  const hasBrowserSignal =
    record?.mechanism === vocabulary.mechanisms.browserSignal;
  const isRecordDecided =
    record !== undefined &&
    record.category === vocabulary.category &&
    typeof decidedAt === "number" &&
    decidedAt >= 0 &&
    isKnownNotice &&
    ((isGranted && hasPrivacyControls) ||
      (isDenied && (hasPrivacyControls || hasBrowserSignal))) &&
    (isDenied || record.noticeVersion === noticeVersion);
  return isRecordDecided ? "decided" : null;
}

/**
 * The inline script that runs before the usage-data prompt paints. It reads what
 * the consent store writes, asks the decision for the mark, and writes the mark on
 * the document root when there is one. The prompt's hide rule matches that mark,
 * and the consent provider removes the mark once the store knows the choice.
 *
 * It never writes a decision. Storage that cannot be read keeps the prompt shown.
 */
export const ANALYTICS_CONSENT_BOOTSTRAP_SCRIPT = `(function () {
  try {
    var mark = (${resolveAnalyticsConsentMark.toString()})({
      anonymousRecord: localStorage.getItem(${literal(ANONYMOUS_ANALYTICS_CONSENT_STORAGE_KEY)}),
      doNotTrack: navigator.doNotTrack,
      globalPrivacyControl: "globalPrivacyControl" in navigator ? navigator.globalPrivacyControl : undefined,
      knownSession: localStorage.getItem(${literal(KNOWN_SESSION_KEY)}),
      noticeVersion: ${literal(ANALYTICS_CONSENT_NOTICE_VERSION)},
      readRecord: ${READ_RECORD_SCRIPT},
      vocabulary: ${vocabularyLiteral(ANALYTICS_CONSENT_BOOTSTRAP_VOCABULARY)}
    });
    if (mark !== null) {
      document.documentElement.setAttribute(${literal(ANALYTICS_CONSENT_ROOT_ATTRIBUTE)}, mark);
    }
  } catch (error) {
    // Deliberate silent exception: this script runs before the app modules load
    // and before paint, so it cannot reach the analytics leaf. Storage that cannot
    // be read keeps the prompt shown. markAnalyticsConsentRoot reads the same
    // storage on mount and reports that failure with its cause.
  }
})();`;

/**
 * Marks the document root before paint on a page the server rendered without the
 * inline script, such as the first app page that a soft navigation opens. It reads
 * the stored values the script reads and writes the same mark, so both agree.
 * Storage that cannot be read keeps the prompt shown.
 */
export const markAnalyticsConsentRoot = Effect.fn(
  "www.analytics.markAnalyticsConsentRoot"
)(function* (
  root: Pick<HTMLElement, "setAttribute">,
  privacySignal: BrowserPrivacySignal,
  storage?: Pick<Storage, "getItem">
) {
  const mark = yield* Effect.try(() => {
    const target = storage ?? window.localStorage;
    return resolveAnalyticsConsentMark({
      anonymousRecord: target.getItem(ANONYMOUS_ANALYTICS_CONSENT_STORAGE_KEY),
      doNotTrack: privacySignal.doNotTrack,
      globalPrivacyControl: privacySignal.globalPrivacyControl,
      knownSession: target.getItem(KNOWN_SESSION_KEY),
      noticeVersion: ANALYTICS_CONSENT_NOTICE_VERSION,
      readRecord: readStoredRecord,
      vocabulary: ANALYTICS_CONSENT_BOOTSTRAP_VOCABULARY,
    });
  }).pipe(
    Effect.map(Option.fromNullishOr),
    Effect.catch((cause) =>
      reportClientException(cause, {
        operation: "resolveConsentMark",
        source: "analytics.consentRoot",
      }).pipe(Effect.as(Option.none()))
    )
  );

  if (Option.isSome(mark)) {
    root.setAttribute(ANALYTICS_CONSENT_ROOT_ATTRIBUTE, mark.value);
  }
});
