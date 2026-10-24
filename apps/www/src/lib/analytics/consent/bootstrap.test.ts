import { afterEach, describe, expect, it } from "@effect/vitest";
import {
  ANALYTICS_CONSENT_NOTICE_VERSION,
  ANALYTICS_CONSENT_ROOT_ATTRIBUTE,
  ANONYMOUS_ANALYTICS_CONSENT_STORAGE_KEY,
  type AnalyticsConsentState,
  CONSENT_NOTICE_VERSIONS,
  decodeAnonymousAnalyticsConsent,
  hasBrowserPrivacySignal,
  resolveAnalyticsConsentState,
} from "@repo/analytics/consent";
import { Effect, Option, Schema } from "effect";
import type { reportClientException } from "@/lib/analytics/client";
import {
  ANALYTICS_CONSENT_BOOTSTRAP_SCRIPT,
  ANALYTICS_CONSENT_BOOTSTRAP_VOCABULARY,
  markAnalyticsConsentRoot,
  READ_RECORD_SCRIPT,
  resolveAnalyticsConsentMark,
} from "@/lib/analytics/consent/bootstrap";
import { EXPECTED_SESSION, KNOWN_SESSION_KEY } from "@/lib/auth/keys";

const reportClientExceptionMock = vi.hoisted(() =>
  vi.fn<typeof reportClientException>(() => Effect.void)
);
vi.mock("@/lib/analytics/client", () => ({
  reportClientException: reportClientExceptionMock,
}));

const CURRENT = ANALYTICS_CONSENT_NOTICE_VERSION;
const OLDER = CONSENT_NOTICE_VERSIONS[1];
const SESSION = "session-1";

const JsonRecordSchema = Schema.fromJsonString(
  Schema.Record(Schema.String, Schema.Unknown)
);

/** Writes an object as the JSON text a browser stores, whatever its fields hold. */
const storedJson = Schema.encodeSync(JsonRecordSchema);

/** Writes one text as a JavaScript string literal, the way the bootstrap script embeds its constants. */
const jsString = Schema.encodeSync(Schema.fromJsonString(Schema.String));

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

/**
 * One case: the stored values and browser signal, and what the page must do with
 * them. `decided` names the decided mark. A known session that is not decided is
 * pending, because the store waits for that session's answer.
 */
const BootstrapCaseSchema = Schema.Struct({
  anonymousRecord: Schema.optionalKey(Schema.String),
  decided: Schema.Boolean,
  doNotTrack: Schema.optionalKey(Schema.String),
  globalPrivacyControl: Schema.optionalKey(Schema.Unknown),
  knownSession: Schema.optionalKey(Schema.String),
  name: Schema.String,
});

type BootstrapCase = typeof BootstrapCaseSchema.Type;

/**
 * The reader the table passes, with the same answer as the page's: an object, or
 * undefined for anything else. The reader test below runs the page's own reader.
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

  // A known session, or a sign-in on its way, keeps the viewer loading until Better
  // Auth and Convex answer. Without one, the anonymous record decides.
  return resolveAnalyticsConsentState({
    accountConsent: null,
    anonymousConsent,
    hasBrowserPrivacySignal: hasSignal,
    isAccountConsentResolved: false,
    isAuthenticated: false,
    isAuthLoading: bootstrapCase.knownSession !== undefined,
  }).status;
}

/** The mark the decision resolves for one case, with the table's reader. */
function markOf(bootstrapCase: BootstrapCase) {
  return resolveAnalyticsConsentMark({
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
  if (bootstrapCase.knownSession !== undefined) {
    return "pending";
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
    name: "a privacy signal decides over a signed-in session",
  },
  {
    anonymousRecord: anonymous({ decision: "denied" }),
    decided: false,
    knownSession: EXPECTED_SESSION,
    name: "a sign-in on its way decides nothing, even with an anonymous denial",
  },
  {
    anonymousRecord: anonymous(),
    decided: false,
    knownSession: EXPECTED_SESSION,
    name: "a sign-in on its way decides nothing, even with an anonymous grant",
  },
  {
    decided: true,
    doNotTrack: "1",
    knownSession: EXPECTED_SESSION,
    name: "a privacy signal decides over a sign-in on its way",
  },
  {
    decided: false,
    knownSession: SESSION,
    name: "a signed-in session holds the prompt until the account answers",
  },
  {
    anonymousRecord: anonymous({ decision: "denied" }),
    decided: false,
    knownSession: SESSION,
    name: "an anonymous denial does not decide for a signed-in session",
  },
  {
    anonymousRecord: anonymous(),
    decided: false,
    knownSession: SESSION,
    name: "an anonymous grant does not decide for a signed-in session",
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
    });
  }

  // The script runs the decision on the source text of the function, so the two
  // cannot drift. The browser suites run the real script in a production page.
  it("is the decision the inline script calls, so no second copy of the rule exists", () => {
    expect(ANALYTICS_CONSENT_BOOTSTRAP_SCRIPT).toContain(
      `(${resolveAnalyticsConsentMark.toString()})({`
    );
  });

  it("keeps the prompt shown and writes no mark when the store cannot be read", () => {
    const marks = new Map<string, string>();
    const runScript = new Function(
      "localStorage",
      "navigator",
      "document",
      ANALYTICS_CONSENT_BOOTSTRAP_SCRIPT
    );
    runScript(
      {
        getItem: () => {
          throw new TypeError("Storage is blocked.");
        },
      },
      { doNotTrack: "1" },
      {
        documentElement: {
          setAttribute: (name: string, value: string) => {
            marks.set(name, value);
          },
        },
      }
    );
    expect(marks.size).toBe(0);
  });
});

/** Stores one case's values in this browser and makes the navigator report its signals. */
function arrangeBrowser(bootstrapCase: BootstrapCase) {
  window.localStorage.clear();
  if (bootstrapCase.anonymousRecord !== undefined) {
    window.localStorage.setItem(
      ANONYMOUS_ANALYTICS_CONSENT_STORAGE_KEY,
      bootstrapCase.anonymousRecord
    );
  }
  if (bootstrapCase.knownSession !== undefined) {
    window.localStorage.setItem(KNOWN_SESSION_KEY, bootstrapCase.knownSession);
  }
  Object.defineProperty(window.navigator, "doNotTrack", {
    configurable: true,
    value: bootstrapCase.doNotTrack ?? null,
  });
  if (bootstrapCase.globalPrivacyControl !== undefined) {
    Object.defineProperty(window.navigator, "globalPrivacyControl", {
      configurable: true,
      value: bootstrapCase.globalPrivacyControl,
    });
  }
}

/** Puts this browser back as the test found it. */
function resetBrowser() {
  window.localStorage.clear();
  document.documentElement.removeAttribute(ANALYTICS_CONSENT_ROOT_ATTRIBUTE);
  Reflect.deleteProperty(window.navigator, "doNotTrack");
  Reflect.deleteProperty(window.navigator, "globalPrivacyControl");
}

/** The mark the document root carries now, or null for none. */
function rootMark() {
  return document.documentElement.getAttribute(
    ANALYTICS_CONSENT_ROOT_ATTRIBUTE
  );
}

describe("analytics consent bootstrap in the document", () => {
  afterEach(() => {
    resetBrowser();
  });

  // The client mount reads the browser's own storage and navigator, so each case's
  // stored values must mark the root as the decision table says.
  for (const bootstrapCase of cases) {
    it.effect(
      `marks the root as the decision says for ${bootstrapCase.name}`,
      () =>
        Effect.gen(function* () {
          arrangeBrowser(bootstrapCase);
          yield* markAnalyticsConsentRoot(document.documentElement, {
            doNotTrack: bootstrapCase.doNotTrack ?? null,
            globalPrivacyControl: bootstrapCase.globalPrivacyControl,
          });

          expect(rootMark()).toBe(expectedMarkOf(bootstrapCase));
        })
    );
  }

  it.effect(
    "marks a signed-in session pending on a page the server did not render",
    () =>
      Effect.gen(function* () {
        window.localStorage.setItem(KNOWN_SESSION_KEY, SESSION);

        yield* markAnalyticsConsentRoot(document.documentElement, {
          doNotTrack: null,
          globalPrivacyControl: undefined,
        });

        expect(rootMark()).toBe("pending");
      })
  );

  it.effect("keeps the prompt shown when storage cannot be read", () =>
    Effect.gen(function* () {
      const unreadable = {
        getItem: () => {
          throw new Error("storage unavailable");
        },
      };

      reportClientExceptionMock.mockClear();

      yield* markAnalyticsConsentRoot(
        document.documentElement,
        { doNotTrack: null, globalPrivacyControl: undefined },
        unreadable
      );

      expect(rootMark()).toBeNull();
      expect(reportClientExceptionMock).toHaveBeenCalledWith(
        expect.anything(),
        {
          operation: "resolveConsentMark",
          source: "analytics.consentRoot",
        }
      );
    })
  );
});

/**
 * Runs the shipped reader on one stored text, as the inline script calls it, and
 * returns its answer as text. The reader is source text rather than a function
 * this suite compiles, so it runs in the document exactly as the page runs it.
 */
function shippedReaderAnswer(text: string) {
  const script = document.createElement("script");
  script.textContent = `(function () {
    var value = (${READ_RECORD_SCRIPT})(${jsString(text)});
    document.documentElement.setAttribute("data-reader-answer", value === undefined ? "undefined" : JSON.stringify(value));
  })();`;
  document.head.append(script);
  script.remove();
  const answer = document.documentElement.getAttribute("data-reader-answer");
  document.documentElement.removeAttribute("data-reader-answer");
  return answer;
}

describe("analytics consent bootstrap reader", () => {
  const readerCases: readonly (readonly [string, string])[] = [
    [
      '{"noticeVersion":"privacy-2026-08-22"}',
      '{"noticeVersion":"privacy-2026-08-22"}',
    ],
    ["{", "undefined"],
    ["null", "undefined"],
    ["42", "undefined"],
    ['"text"', "undefined"],
  ];

  for (const [text, answer] of readerCases) {
    it(`answers ${answer} for the stored text ${text}`, () => {
      expect(shippedReaderAnswer(text)).toBe(answer);
    });
  }
});
