import { Schema } from "effect";

/** The path of the one callback of the connectors project on each site (ADR 0015). */
export const CALLBACK_PATH = "/api/connectors/google/callback";

/** The prefix of every Google scope that a connector asks for. */
const SCOPE_ROOT = "https://www.googleapis.com/auth/";

/**
 * The Google connectors that the connect flow serves (ADR 0015). Forms waits for
 * its Picker test and Gmail for its security assessment, so neither is here.
 */
export const GoogleConnector = Schema.Literals([
  "drive",
  "calendar",
  "classroom",
]);

/** One Google connector. */
export type GoogleConnector = typeof GoogleConnector.Type;

/**
 * What each Google connector asks for and who holds it. A connection asks for its
 * own connector's scopes and `openid`, which names the Google account so that the
 * revoke rule counts its grants. Drive and Calendar are a learner's own
 * connections (journey J8); Classroom is a school's, made by a teacher or an
 * Admin (journey J7). `review` says whether a scope waits for Google's review
 * before the connector reaches production users: Drive's `drive.file` is
 * non-sensitive, Calendar's scope is sensitive, and Google's pages give no class
 * for the Classroom scopes, so Classroom waits for the Data Access panel.
 */
export const GOOGLE_MANIFEST = {
  calendar: {
    owner: "personal",
    review: true,
    scopes: [`${SCOPE_ROOT}calendar.events.readonly`],
  },
  classroom: {
    owner: "school",
    review: true,
    scopes: [
      `${SCOPE_ROOT}classroom.courses.readonly`,
      `${SCOPE_ROOT}classroom.rosters.readonly`,
      `${SCOPE_ROOT}classroom.coursework.students.readonly`,
    ],
  },
  drive: {
    owner: "personal",
    review: false,
    scopes: [`${SCOPE_ROOT}drive.file`],
  },
} as const satisfies Record<
  GoogleConnector,
  {
    readonly owner: "personal" | "school";
    readonly review: boolean;
    readonly scopes: readonly string[];
  }
>;

/** The scopes one connection of a connector asks Google for: `openid` and the connector's own. */
export const requestedScopes = (connector: GoogleConnector) => [
  "openid",
  ...GOOGLE_MANIFEST[connector].scopes,
];
