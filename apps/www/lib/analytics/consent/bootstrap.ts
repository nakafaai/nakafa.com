import {
  ANALYTICS_BROWSER_SIGNAL_MECHANISM,
  ANALYTICS_CONSENT_ACCOUNT_STORAGE_KEY,
  ANALYTICS_CONSENT_CATEGORY,
  ANALYTICS_CONSENT_DENIED,
  ANALYTICS_CONSENT_GRANTED,
  ANALYTICS_CONSENT_MECHANISM,
  ANALYTICS_CONSENT_NOTICE_VERSION,
  ANALYTICS_CONSENT_ROOT_ATTRIBUTE,
  ANONYMOUS_ANALYTICS_CONSENT_STORAGE_KEY,
  CONSENT_NOTICE_VERSIONS,
} from "@repo/analytics/consent";
import { Schema } from "effect";
import { EXPECTED_SESSION, KNOWN_SESSION_KEY } from "@/lib/auth/keys";

/** The literals the decision compares against, named as the consent store names them. */
const BootstrapVocabularySchema = Schema.Struct({
  category: Schema.String,
  decisions: Schema.Struct({ denied: Schema.String, granted: Schema.String }),
  expectedSession: Schema.String,
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
  expectedSession: EXPECTED_SESSION,
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
const READ_RECORD_SCRIPT = `function (text) {
  var value;
  try {
    value = JSON.parse(text);
  } catch (error) {
    return undefined;
  }
  return value !== null && typeof value === "object" ? value : undefined;
}`;

/**
 * Resolves the mark the inline script writes on the document root before paint,
 * from the raw values this browser holds. It is "decided" when the viewer has
 * already decided for the current notice, "signing-in" while a sign-in is on its
 * way, and null when the prompt may show.
 *
 * The inline script is built from this function's source text, so it refers to
 * nothing outside its body: every value arrives as an argument, and so does the
 * reader that turns a stored text into a record. The page passes JSON parsing. The
 * unit table passes a generic JSON record reader, and the script test runs the
 * page's own reader through the real script. This runs before any import, the
 * same exception AGENTS.md names for code that Playwright serializes into the
 * page. It mirrors `resolveAnalyticsConsentState` in the consent store: "decided"
 * exactly when the store's status is neither prompt nor pending, and
 * "signing-in" only while that status is pending.
 */
export function resolveAnalyticsConsentMark({
  accountMarker,
  anonymousRecord,
  doNotTrack,
  globalPrivacyControl,
  knownSession,
  noticeVersion,
  readRecord,
  vocabulary,
}: {
  readonly accountMarker: string | null;
  readonly anonymousRecord: string | null;
  readonly doNotTrack: string | null | undefined;
  readonly globalPrivacyControl: unknown;
  readonly knownSession: string | null;
  readonly noticeVersion: string;
  readonly readRecord: (
    text: string
  ) => Readonly<Record<string, unknown>> | undefined;
  readonly vocabulary: BootstrapVocabulary;
}): "decided" | "signing-in" | null {
  // A browser privacy signal is a decision of its own, as the store reads it.
  if (
    globalPrivacyControl === true ||
    doNotTrack === "1" ||
    doNotTrack === "yes"
  ) {
    return "decided";
  }

  // A sign-in on its way holds the prompt until Better Auth names its session.
  if (knownSession === vocabulary.expectedSession) {
    return "signing-in";
  }

  // A signed-in session decides only through the account marker it names. A
  // denial decides under any notice, and a grant under the current one only.
  if (knownSession !== null) {
    const marker =
      accountMarker === null ? undefined : readRecord(accountMarker);
    const granted = marker?.granted;
    const markerNotice = marker?.noticeVersion;
    const isMarkerDecided =
      marker?.sessionId === knownSession &&
      typeof granted === "boolean" &&
      typeof markerNotice === "string" &&
      (!granted || markerNotice === noticeVersion);
    return isMarkerDecided ? "decided" : null;
  }

  // Without a signed-in session, the anonymous record decides, under the same
  // rule: a denial under any notice, and a grant under the current one only.
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
      accountMarker: localStorage.getItem(${literal(ANALYTICS_CONSENT_ACCOUNT_STORAGE_KEY)}),
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
    // Storage that cannot be read keeps the prompt shown.
  }
})();`;
