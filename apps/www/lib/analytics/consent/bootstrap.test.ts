import { describe, expect, it } from "@effect/vitest";
import {
  ANALYTICS_CONSENT_NOTICE_VERSION,
  type AnalyticsConsentAccountMarker,
  type AnalyticsConsentState,
  CONSENT_NOTICE_VERSIONS,
  decodeAnalyticsConsentAccountMarker,
  decodeAnonymousAnalyticsConsent,
  hasBrowserPrivacySignal,
  resolveAnalyticsConsentState,
} from "@repo/analytics/consent";
import { Option, Schema } from "effect";
import {
  ANALYTICS_CONSENT_BOOTSTRAP_SCRIPT,
  ANALYTICS_CONSENT_BOOTSTRAP_VOCABULARY,
  resolveAnalyticsConsentMark,
} from "@/lib/analytics/consent/bootstrap";
import { EXPECTED_SESSION } from "@/lib/auth/keys";

const CURRENT = ANALYTICS_CONSENT_NOTICE_VERSION;
const OLDER = CONSENT_NOTICE_VERSIONS[1];
const SESSION = "session-1";
const OTHER_SESSION = "session-2";

const JsonRecordSchema = Schema.fromJsonString(
  Schema.Record(Schema.String, Schema.Unknown)
);

/** Writes an object as the JSON text a browser stores, whatever its fields hold. */
const storedJson = Schema.encodeSync(JsonRecordSchema);

/** The stored anonymous record, with the fields a case changes. */
function anonymous(overrides: Readonly<Record<string, unknown>> = {}) {
  return storedJson({
    category: "analytics",
    decidedAt: 1,
    decision: "granted",
    mechanism: "privacy-controls",
    noticeVersion: CURRENT,
    ...overrides,
  });
}

/** The stored account marker, with the fields a case changes. */
function marker(overrides: Readonly<Record<string, unknown>> = {}) {
  return storedJson({
    granted: true,
    noticeVersion: CURRENT,
    sessionId: SESSION,
    ...overrides,
  });
}

/**
 * One case: the stored values and browser signal, and what the page must do with
 * them. `decided` and `signingIn` name the mark the decision writes on the root.
 */
const BootstrapCaseSchema = Schema.Struct({
  accountMarker: Schema.optionalKey(Schema.String),
  anonymousRecord: Schema.optionalKey(Schema.String),
  decided: Schema.Boolean,
  doNotTrack: Schema.optionalKey(Schema.String),
  globalPrivacyControl: Schema.optionalKey(Schema.Unknown),
  knownSession: Schema.optionalKey(Schema.String),
  name: Schema.String,
  signingIn: Schema.optionalKey(Schema.Boolean),
});

type BootstrapCase = typeof BootstrapCaseSchema.Type;

/**
 * The reader the table passes, with the same answer as the page's: an object, or
 * undefined for anything else. The script test below runs the page's own reader.
 */
const readRecord = (text: string) =>
  Option.getOrUndefined(Schema.decodeOption(JsonRecordSchema)(text));

/** The consent store's resolution of the same stored values, as its readers see them. */
function storeStatusOf(
  bootstrapCase: BootstrapCase
): AnalyticsConsentState["status"] {
  const hasSignal = hasBrowserPrivacySignal({
    doNotTrack: [bootstrapCase.doNotTrack ?? null],
    globalPrivacyControl: bootstrapCase.globalPrivacyControl,
  });
  const anonymousConsent =
    bootstrapCase.anonymousRecord === undefined
      ? Option.none()
      : decodeAnonymousAnalyticsConsent(bootstrapCase.anonymousRecord);

  // Without a known session the viewer is anonymous once the browser has its record.
  if (bootstrapCase.knownSession === undefined) {
    return resolveAnalyticsConsentState({
      accountConsent: null,
      anonymousConsent,
      hasBrowserPrivacySignal: hasSignal,
      isAccountConsentResolved: false,
      isAuthenticated: false,
      isAuthLoading: false,
    }).status;
  }

  // The sign-in on its way keeps the viewer loading until Better Auth answers.
  if (bootstrapCase.knownSession === EXPECTED_SESSION) {
    return resolveAnalyticsConsentState({
      accountConsent: null,
      anonymousConsent,
      hasBrowserPrivacySignal: hasSignal,
      isAccountConsentResolved: false,
      isAuthenticated: false,
      isAuthLoading: true,
    }).status;
  }

  // A signed-in session reads only the account marker that names it.
  const named = Option.filter(
    bootstrapCase.accountMarker === undefined
      ? Option.none<AnalyticsConsentAccountMarker>()
      : decodeAnalyticsConsentAccountMarker(bootstrapCase.accountMarker),
    (stored) => stored.sessionId === bootstrapCase.knownSession
  );
  const accountConsent = Option.match(named, {
    onNone: () => null,
    onSome: (stored) => ({
      granted: stored.granted,
      noticeVersion: stored.noticeVersion,
    }),
  });
  return resolveAnalyticsConsentState({
    accountConsent,
    anonymousConsent,
    hasBrowserPrivacySignal: hasSignal,
    isAccountConsentResolved: accountConsent !== null,
    isAuthenticated: true,
    isAuthLoading: false,
  }).status;
}

/** The mark the decision resolves for one case, with the table's reader. */
function markOf(bootstrapCase: BootstrapCase) {
  return resolveAnalyticsConsentMark({
    accountMarker: bootstrapCase.accountMarker ?? null,
    anonymousRecord: bootstrapCase.anonymousRecord ?? null,
    doNotTrack: bootstrapCase.doNotTrack ?? null,
    globalPrivacyControl: bootstrapCase.globalPrivacyControl,
    knownSession: bootstrapCase.knownSession ?? null,
    noticeVersion: CURRENT,
    readRecord,
    vocabulary: ANALYTICS_CONSENT_BOOTSTRAP_VOCABULARY,
  });
}

/** The mark that the table says the page writes for one case, or null for none. */
function expectedMarkOf(bootstrapCase: BootstrapCase) {
  if (bootstrapCase.decided) {
    return "decided";
  }
  if (bootstrapCase.signingIn) {
    return "signing-in";
  }
  return null;
}

const cases: readonly BootstrapCase[] = [
  { decided: false, name: "nothing is stored and no privacy signal is set" },
  {
    anonymousRecord: anonymous(),
    decided: true,
    name: "an anonymous grant under the current notice",
  },
  {
    anonymousRecord: anonymous({ noticeVersion: OLDER }),
    decided: false,
    name: "an anonymous grant under an older notice",
  },
  {
    anonymousRecord: anonymous({ decision: "denied" }),
    decided: true,
    name: "an anonymous denial under the current notice",
  },
  {
    anonymousRecord: anonymous({ decision: "denied", noticeVersion: OLDER }),
    decided: true,
    name: "an anonymous denial under an older notice",
  },
  {
    anonymousRecord: anonymous({
      decision: "denied",
      mechanism: "browser-privacy-signal",
    }),
    decided: true,
    name: "an anonymous denial recorded by a privacy signal",
  },
  {
    anonymousRecord: anonymous({
      decision: "granted",
      mechanism: "browser-privacy-signal",
    }),
    decided: false,
    name: "an anonymous grant with the privacy signal mechanism",
  },
  {
    anonymousRecord: anonymous({ decision: "maybe" }),
    decided: false,
    name: "an anonymous record with an unknown decision",
  },
  {
    anonymousRecord: anonymous({ mechanism: "unknown-mechanism" }),
    decided: false,
    name: "an anonymous grant with an unknown mechanism",
  },
  {
    anonymousRecord: anonymous({
      decision: "denied",
      noticeVersion: "privacy-1999-01-01",
    }),
    decided: false,
    name: "an anonymous denial under a notice the consent list does not know",
  },
  {
    anonymousRecord: anonymous({ category: "marketing" }),
    decided: false,
    name: "an anonymous record for another category",
  },
  {
    anonymousRecord: anonymous({ decidedAt: -1 }),
    decided: false,
    name: "an anonymous record with a negative decision time",
  },
  {
    anonymousRecord: anonymous({ decidedAt: "1" }),
    decided: false,
    name: "an anonymous record whose decision time is not a number",
  },
  {
    anonymousRecord: storedJson({
      category: "analytics",
      decision: "granted",
      mechanism: "privacy-controls",
      noticeVersion: CURRENT,
    }),
    decided: false,
    name: "an anonymous record without a decision time",
  },
  {
    anonymousRecord: "{",
    decided: false,
    name: "an anonymous record that is not JSON",
  },
  {
    anonymousRecord: "null",
    decided: false,
    name: "an anonymous record that is JSON but not an object",
  },
  {
    decided: true,
    doNotTrack: "1",
    name: "a Do Not Track signal of 1 with nothing stored",
  },
  { decided: true, doNotTrack: "yes", name: "a Do Not Track signal of yes" },
  { decided: false, doNotTrack: "0", name: "a Do Not Track signal of 0" },
  {
    decided: true,
    globalPrivacyControl: true,
    name: "a Global Privacy Control signal over nothing stored",
  },
  {
    decided: false,
    globalPrivacyControl: "true",
    name: "a Global Privacy Control value that is not the boolean true",
  },
  {
    anonymousRecord: anonymous({ decision: "denied" }),
    decided: true,
    doNotTrack: "1",
    knownSession: SESSION,
    name: "a privacy signal decides with no marker for the session",
  },
  {
    anonymousRecord: anonymous({ decision: "denied" }),
    decided: false,
    knownSession: EXPECTED_SESSION,
    name: "a sign-in on its way decides nothing, even with an anonymous denial",
    signingIn: true,
  },
  {
    anonymousRecord: anonymous(),
    decided: false,
    knownSession: EXPECTED_SESSION,
    name: "a sign-in on its way decides nothing, even with an anonymous grant",
    signingIn: true,
  },
  {
    accountMarker: marker({ sessionId: EXPECTED_SESSION }),
    decided: false,
    knownSession: EXPECTED_SESSION,
    name: "a marker that names the expected session does not decide",
    signingIn: true,
  },
  {
    decided: true,
    doNotTrack: "1",
    knownSession: EXPECTED_SESSION,
    name: "a privacy signal decides over a sign-in on its way",
  },
  {
    accountMarker: marker(),
    decided: true,
    knownSession: SESSION,
    name: "a current grant that the session's marker names",
  },
  {
    accountMarker: marker({ noticeVersion: OLDER }),
    decided: false,
    knownSession: SESSION,
    name: "an older grant that the session's marker names",
  },
  {
    accountMarker: marker({ granted: false, noticeVersion: OLDER }),
    decided: true,
    knownSession: SESSION,
    name: "a denial under an older notice that the session's marker names",
  },
  {
    accountMarker: marker({ granted: false }),
    decided: true,
    knownSession: SESSION,
    name: "a current denial that the session's marker names",
  },
  {
    accountMarker: marker({ sessionId: OTHER_SESSION }),
    decided: false,
    knownSession: SESSION,
    name: "a current grant marker of another session",
  },
  {
    anonymousRecord: anonymous({ decision: "denied" }),
    decided: false,
    knownSession: SESSION,
    name: "an anonymous denial with no marker for the session",
  },
  {
    decided: false,
    knownSession: SESSION,
    name: "a signed-in session with no marker",
  },
  {
    accountMarker: "{",
    decided: false,
    knownSession: SESSION,
    name: "a marker that is not JSON",
  },
  {
    accountMarker: marker({ granted: "yes" }),
    decided: false,
    knownSession: SESSION,
    name: "a marker whose grant is not a boolean",
  },
  {
    accountMarker: marker({ granted: false, noticeVersion: 5 }),
    decided: false,
    knownSession: SESSION,
    name: "a denial marker whose notice is not text",
  },
  {
    accountMarker: marker(),
    decided: false,
    name: "a current grant marker with no known session",
  },
  {
    accountMarker: marker({ granted: false, sessionId: OTHER_SESSION }),
    decided: false,
    name: "a denial marker of an older session with no known session",
  },
  {
    accountMarker: marker({ sessionId: OTHER_SESSION }),
    anonymousRecord: anonymous(),
    decided: true,
    name: "an anonymous grant decides when only another session's marker is stored",
  },
];

describe("analytics consent bootstrap decision", () => {
  for (const bootstrapCase of cases) {
    it(`matches the consent store for ${bootstrapCase.name}`, () => {
      const mark = markOf(bootstrapCase);
      const storeStatus = storeStatusOf(bootstrapCase);

      expect(mark).toBe(expectedMarkOf(bootstrapCase));
      expect(storeStatus !== "prompt" && storeStatus !== "pending").toBe(
        mark === "decided"
      );
      // The mark for a sign-in on its way lasts only while the store is pending.
      if (mark === "signing-in") {
        expect(storeStatus).toBe("pending");
      }
    });
  }

  // The script runs the decision on the source text of the function, so the two
  // cannot drift. The browser suite runs the real script in a page.
  it("is the decision the inline script calls, so no second copy of the rule exists", () => {
    expect(ANALYTICS_CONSENT_BOOTSTRAP_SCRIPT).toContain(
      `(${resolveAnalyticsConsentMark.toString()})({`
    );
  });
});
