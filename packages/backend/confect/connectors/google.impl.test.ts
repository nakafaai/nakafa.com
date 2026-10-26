import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { createTenantKey } from "@repo/backend/confect/vault/keys";
import {
  scheduledJobs,
  slugOf,
  TENANCY_NOW,
  tenancyFixture,
} from "@repo/backend/test/tenancy";
import { encodeJsonText } from "@repo/utilities/json";
import { Array as Arr, Effect } from "effect";
import { Base64Url } from "effect/encoding";

/** The fetch that the finish action's client calls, stubbed once for the file. */
const fetcher = vi.fn<typeof fetch>();
vi.stubGlobal("fetch", fetcher);

const nf = slugOf("nf");
const google = refs.public.connectors.google;
const { listOwn, listSchool } = refs.public.connectors.connections;
const firstPage = { paginationOpts: { cursor: null, numItems: 10 } };

/** The callback of the local site, which a start must name. */
const CALLBACK = "http://localhost:3000/api/connectors/google/callback";

/** The page of an account's own connectors, which a personal connect returns to. */
const OWN_PAGE = "/user/settings/connectors";

/** The page of a school's connections, which a school connect returns to. */
const SCHOOL_PAGE = "/settings/connections";

const DRIVE = "https://www.googleapis.com/auth/drive.file";
const CLASSROOM_SCOPES = [
  "https://www.googleapis.com/auth/classroom.courses.readonly",
  "https://www.googleapis.com/auth/classroom.rosters.readonly",
  "https://www.googleapis.com/auth/classroom.coursework.students.readonly",
];

/** Google's answer to a code exchange that grants `scopes` to the account `subject`. */
const granted = (subject: string, scopes: readonly string[]) =>
  new Response(
    encodeJsonText({
      access_token: "access",
      expires_in: 3599,
      id_token: `h.${Base64Url.encode(new TextEncoder().encode(encodeJsonText({ sub: subject })))}.s`,
      refresh_token: `refresh-${subject}`,
      scope: Arr.join(["openid", ...scopes], " "),
    }),
    { headers: { "content-type": "application/json" }, status: 200 }
  );

/** The state that a consent address carries back to the callback. */
const stateOf = (url: string) => new URL(url).searchParams.get("state") ?? "";

/** Every connect that waits for its callback. */
const states = Effect.flatMap(DatabaseReader, (reader) =>
  reader.table("connectorStates").index("by_creation_time").take(10)
);

/** Every sealed token. */
const secrets = Effect.flatMap(DatabaseReader, (reader) =>
  reader.table("connectorSecrets").index("by_creation_time").take(10)
);

describe("connectors/google", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TENANCY_NOW);
    fetcher.mockReset();
    vi.stubEnv("SITE_URL", "http://localhost:3000");
    vi.stubEnv("GOOGLE_CONNECTORS", "drive, calendar,unknown,classroom,drive");
    vi.stubEnv(
      "GOOGLE_CONNECTOR_CLIENT_ID",
      "client.apps.googleusercontent.com"
    );
    vi.stubEnv("GOOGLE_CONNECTOR_CLIENT_SECRET", "test-secret");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.effect(
    "offers the connectors this deployment lists, and none when it lists none or lacks the secret",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const student = fixture.as("student");
        expect(yield* student.query(google.offered, {})).toEqual([
          "drive",
          "calendar",
          "classroom",
        ]);
        vi.stubEnv("GOOGLE_CONNECTOR_CLIENT_SECRET", undefined);
        expect(
          yield* student
            .mutation(google.startPersonal, {
              connector: "drive",
              redirectUri: CALLBACK,
              returnPath: OWN_PAGE,
            })
            .pipe(Effect.flip)
        ).toMatchObject({ _tag: "ConnectorOff" });
        vi.stubEnv("GOOGLE_CONNECTORS", undefined);
        expect(yield* student.query(google.offered, {})).toEqual([]);
        expect(
          yield* student
            .mutation(google.startPersonal, {
              connector: "drive",
              redirectUri: CALLBACK,
              returnPath: OWN_PAGE,
            })
            .pipe(Effect.flip)
        ).toMatchObject({ _tag: "ConnectorOff" });
      })
  );

  it.effect(
    "starts a personal connect for the site's own callback only, keeps one pending connect an account, and refuses a school connector",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const student = fixture.as("student");
        const start = (connector: "drive" | "classroom", redirectUri: string) =>
          student.mutation(google.startPersonal, {
            connector,
            redirectUri,
            returnPath: OWN_PAGE,
          });
        const first = yield* start("drive", CALLBACK);
        const second = yield* start("drive", CALLBACK);
        const url = new URL(second.url);
        expect(url.host).toBe("accounts.google.com");
        expect(url.searchParams.get("scope")).toBe(`openid ${DRIVE}`);
        const pending = yield* fixture.run(states);
        expect(Arr.map(pending, (row) => row.state)).toEqual([
          stateOf(second.url),
        ]);
        expect(stateOf(first.url)).not.toBe(stateOf(second.url));
        expect(
          yield* start("drive", "https://evil.example/callback").pipe(
            Effect.flip
          )
        ).toMatchObject({ _tag: "ConnectorOff" });
        expect(
          yield* start("classroom", CALLBACK).pipe(Effect.flip)
        ).toMatchObject({ _tag: "ConnectorOff" });
      })
  );

  it.effect(
    "finishes a personal connect once, seals its token, and answers where to return",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const student = fixture.as("student");
        const started = yield* student.mutation(google.startPersonal, {
          connector: "drive",
          redirectUri: CALLBACK,
          returnPath: OWN_PAGE,
        });
        fetcher.mockResolvedValueOnce(granted("subject-1", [DRIVE]));
        const state = stateOf(started.url);
        expect(
          yield* student.action(google.finish, { code: "code-1", state })
        ).toEqual({
          location: `http://localhost:3000${OWN_PAGE}`,
          outcome: "connected",
        });
        const listed = yield* student.query(listOwn, firstPage);
        expect(listed.page).toMatchObject([
          { connector: "drive", scopes: ["openid", DRIVE], status: "active" },
        ]);
        expect(encodeJsonText(yield* fixture.run(secrets))).not.toContain(
          "refresh-subject-1"
        );
        expect(
          yield* student
            .action(google.finish, { code: "code-1", state })
            .pipe(Effect.flip)
        ).toMatchObject({ _tag: "ConnectStateInvalid" });
      })
  );

  it.effect(
    "connects nothing for a cancelled consent, missing scopes, a refusal of Google, or a connector turned off, and refuses another account's state or an expired one",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const student = fixture.as("student");
        const start = () =>
          student
            .mutation(google.startPersonal, {
              connector: "calendar",
              redirectUri: CALLBACK,
              returnPath: OWN_PAGE,
            })
            .pipe(Effect.map((started) => stateOf(started.url)));
        expect(
          yield* student.action(google.finish, {
            code: null,
            state: yield* start(),
          })
        ).toEqual({
          location: `http://localhost:3000${OWN_PAGE}`,
          outcome: "cancelled",
        });
        const foreign = yield* start();
        expect(
          yield* fixture
            .as("teacher")
            .action(google.finish, { code: "code", state: foreign })
            .pipe(Effect.flip)
        ).toMatchObject({ _tag: "ConnectStateInvalid" });
        const late = yield* start();
        vi.setSystemTime(TENANCY_NOW + 11 * 60 * 1000);
        expect(
          yield* student
            .action(google.finish, { code: "code", state: late })
            .pipe(Effect.flip)
        ).toMatchObject({ _tag: "ConnectStateInvalid" });
        const refusedBy = (answer: () => void) =>
          Effect.gen(function* () {
            const state = yield* start();
            answer();
            return yield* student.action(google.finish, {
              code: "code",
              state,
            });
          });
        expect(
          yield* refusedBy(() =>
            fetcher.mockResolvedValueOnce(granted("subject-2", []))
          )
        ).toMatchObject({ outcome: "refused" });
        expect(
          yield* refusedBy(() =>
            fetcher.mockResolvedValueOnce(
              new Response(encodeJsonText({ error: "invalid_grant" }), {
                status: 400,
              })
            )
          )
        ).toMatchObject({ outcome: "refused" });
        expect(
          yield* refusedBy(() => vi.stubEnv("GOOGLE_CONNECTORS", "drive"))
        ).toMatchObject({ outcome: "refused" });
        expect((yield* student.query(listOwn, firstPage)).page).toEqual([]);
      })
  );

  it.effect(
    "lets an Admin connect the school to Classroom, refuses a teacher and a student, and replaces the connection of the same account on a second connect",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* fixture.run(createTenantKey(fixture.tenants.nf));
        const admin = fixture.as("admin");
        const connect = Effect.gen(function* () {
          const started = yield* admin.mutation(google.startSchool, {
            connector: "classroom",
            redirectUri: CALLBACK,
            returnPath: SCHOOL_PAGE,
            slug: nf,
          });
          fetcher.mockResolvedValueOnce(
            granted("admin-subject", CLASSROOM_SCOPES)
          );
          return yield* admin.action(google.finish, {
            code: "code",
            state: stateOf(started.url),
          });
        });
        expect(yield* connect).toEqual({
          location: `http://nf.localhost:3000${SCHOOL_PAGE}`,
          outcome: "connected",
        });
        yield* connect;
        const listed = yield* admin.query(listSchool, {
          ...firstPage,
          slug: nf,
        });
        expect(
          Arr.map(listed.page, (row) => [row.connector, row.status])
        ).toEqual([
          ["classroom", "disconnected"],
          ["classroom", "active"],
        ]);
        const refused = yield* Effect.forEach(
          ["teacher", "student"] as const,
          (account) =>
            fixture
              .as(account)
              .mutation(google.startSchool, {
                connector: "classroom",
                redirectUri: CALLBACK,
                returnPath: SCHOOL_PAGE,
                slug: nf,
              })
              .pipe(Effect.flip)
        );
        expect(refused).toMatchObject([
          { _tag: "AccessDenied" },
          { _tag: "AccessDenied" },
        ]);
        expect(
          yield* admin
            .mutation(google.startSchool, {
              connector: "drive",
              redirectUri: CALLBACK,
              returnPath: SCHOOL_PAGE,
              slug: nf,
            })
            .pipe(Effect.flip)
        ).toMatchObject({ _tag: "ConnectorOff" });
      })
  );

  it.effect(
    "syncs a new Calendar connection at once, and leaves a Drive connection without a sync",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const student = fixture.as("student");
        const finishWith = (connector: "calendar" | "drive", scope: string) =>
          Effect.gen(function* () {
            const started = yield* student.mutation(google.startPersonal, {
              connector,
              redirectUri: CALLBACK,
              returnPath: OWN_PAGE,
            });
            fetcher.mockResolvedValueOnce(
              granted(`${connector}-subject`, [scope])
            );
            yield* student.action(google.finish, {
              code: "code",
              state: stateOf(started.url),
            });
          });
        yield* finishWith(
          "calendar",
          "https://www.googleapis.com/auth/calendar.events.readonly"
        );
        yield* finishWith("drive", DRIVE);
        const listed = yield* student.query(listOwn, firstPage);
        expect(
          Arr.map(listed.page, (row) => [row.connector, row.nextSyncAt])
        ).toEqual([
          ["drive", null],
          ["calendar", TENANCY_NOW],
        ]);
        const runs = Arr.filter(yield* fixture.run(scheduledJobs), (job) =>
          job.name.includes("sync")
        );
        expect(runs).toHaveLength(1);
      })
  );
});
