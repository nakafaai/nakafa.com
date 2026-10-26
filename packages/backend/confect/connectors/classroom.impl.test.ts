import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { connect } from "@repo/backend/confect/connectors/connection";
import {
  denied,
  firstPage,
  forumClass,
  keyedFixture,
  nf,
  period,
  writeClass,
} from "@repo/backend/test/classroom";
import { otherSchoolTeacher } from "@repo/backend/test/editor";
import { slugOf, TENANCY_NOW } from "@repo/backend/test/tenancy";
import { encodeJsonText } from "@repo/utilities/json";
import { Array as Arr, DateTime, Effect } from "effect";

/** The fetch that the import's client calls, stubbed once for the file. */
const fetcher = vi.fn<typeof fetch>();
vi.stubGlobal("fetch", fetcher);

const classroom = refs.public.connectors.classroom;
const sync = refs.internal.connectors.sync;
const tasks = refs.public.classroom.tasks;

/** The epoch milliseconds of an ISO instant. */
const at = (iso: string) => DateTime.toEpochMillis(DateTime.makeUnsafe(iso));

/** One JSON answer of Google. */
const json = (status: number, body: object) =>
  new Response(encodeJsonText(body), {
    headers: { "content-type": "application/json" },
    status,
  });

/** Classroom as the test's Google answers it: two courses, one with students and coursework due on `due`. */
const classroomAnswers = (due: { day: number; month: number; year: number }) =>
  fetcher.mockImplementation((input) => {
    const url = String(input);
    if (url.startsWith("https://oauth2.googleapis.com/token")) {
      return Promise.resolve(
        json(200, { access_token: "access", expires_in: 3599, scope: "" })
      );
    }
    if (url.includes("/courses/c1/students")) {
      return Promise.resolve(json(200, { students: [{ userId: "s1" }] }));
    }
    if (url.includes("/courses/c1/courseWork")) {
      return Promise.resolve(
        json(200, {
          courseWork: [
            {
              description: "Kerjakan soal 1 sampai 5.",
              dueDate: due,
              id: "123456",
              maxPoints: 150.6,
              title: "Latihan\nGerak",
            },
            { dueDate: due, id: "222", title: "\n" },
            { dueDate: due, id: "333", maxPoints: 5000, title: "Kuis" },
          ],
        })
      );
    }
    if (url.includes("/courses/")) {
      return Promise.resolve(json(200, {}));
    }
    return Promise.resolve(
      json(200, {
        courses: [
          { id: "c1", name: "Fisika", section: "X-1" },
          { id: "c2", name: "Kimia" },
        ],
      })
    );
  });

/** A school with a class and a Classroom connection that the teacher made. */
const school = Effect.gen(function* () {
  const fixture = yield* keyedFixture;
  const term = yield* period(fixture, fixture.units.smp);
  const forum = yield* forumClass(fixture, term.id, "X-1");
  const connectionId = yield* fixture.run(
    connect(
      { id: fixture.people.teacher.personId, kind: "person" },
      { kind: "tenant", tenantId: fixture.tenants.nf },
      {
        connector: "classroom",
        googleSubject: "teacher-subject",
        refreshToken: "refresh-teacher",
        scopes: ["openid"],
      }
    )
  );
  return { classId: forum.classId, connectionId, fixture };
});

describe("connectors/classroom", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TENANCY_NOW);
    fetcher.mockReset();
    vi.stubEnv("GOOGLE_CONNECTORS", "classroom");
    vi.stubEnv("GOOGLE_CONNECTOR_CLIENT_ID", "client");
    vi.stubEnv("GOOGLE_CONNECTOR_CLIENT_SECRET", "secret");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.effect(
    "previews the teacher's courses with their students for an Admin, and refuses a student and someone of another school",
    () =>
      Effect.gen(function* () {
        const { classId, connectionId, fixture } = yield* school;
        classroomAnswers({ day: 1, month: 11, year: 2026 });
        const previewed = yield* fixture
          .as("admin")
          .action(classroom.preview, { slug: nf });
        expect(previewed).toEqual({
          classes: [{ id: classId, name: "Fisika X-1" }],
          connectionId,
          courses: [
            {
              classId: null,
              courseId: "c1",
              name: "Fisika",
              section: "X-1",
              students: 1,
            },
            {
              classId: null,
              courseId: "c2",
              name: "Kimia",
              section: null,
              students: 0,
            },
          ],
        });
        expect(
          yield* fixture
            .as("student")
            .action(classroom.preview, { slug: nf })
            .pipe(Effect.flip)
        ).toMatchObject({ _tag: "AccessDenied" });
        const outsider = yield* otherSchoolTeacher(fixture);
        expect(
          yield* outsider
            .action(classroom.preview, { slug: nf })
            .pipe(Effect.flip)
        ).toMatchObject({ _tag: "AccessDenied" });
        vi.stubEnv("GOOGLE_CONNECTORS", undefined);
        expect(
          yield* fixture
            .as("admin")
            .action(classroom.preview, { slug: nf })
            .pipe(Effect.flip)
        ).toMatchObject({ _tag: "ConnectorOff" });
      })
  );

  it.effect(
    "imports a linked course's coursework into its class once, moves a changed deadline, and stops after the link is removed",
    () =>
      Effect.gen(function* () {
        const { classId, connectionId, fixture } = yield* school;
        const admin = fixture.as("admin");
        classroomAnswers({ day: 1, month: 11, year: 2026 });
        yield* admin.mutation(classroom.link, {
          classId,
          connectionId,
          courseId: "c1",
          slug: nf,
        });
        yield* fixture.internal.action(sync.run, { connectionId });
        const listed = () =>
          fixture
            .as("student")
            .query(tasks.list, { ...firstPage, classId, slug: nf })
            .pipe(Effect.map((page) => page.page));
        const imported = yield* listed();
        expect(
          Arr.map(imported, (task) => [task.title, task.points, task.deadline])
        ).toEqual([
          ["Latihan Gerak", 151, at("2026-11-01T23:59:00Z")],
          ["Kuis", 1000, at("2026-11-01T23:59:00Z")],
        ]);
        expect(imported[0]?.text).toBe("Kerjakan soal 1 sampai 5.");
        expect(imported[1]?.text).toBe("Kuis");
        const previewed = yield* admin.action(classroom.preview, { slug: nf });
        expect(previewed?.courses[0]?.classId).toBe(classId);
        classroomAnswers({ day: 3, month: 11, year: 2026 });
        yield* fixture.internal.action(sync.run, { connectionId });
        expect(Arr.map(yield* listed(), (task) => task.deadline)).toEqual([
          at("2026-11-03T23:59:00Z"),
          at("2026-11-03T23:59:00Z"),
        ]);
        yield* fixture.internal.action(sync.run, { connectionId });
        const quiet = yield* fixture.run(
          Effect.flatMap(DatabaseReader, (reader) =>
            reader.table("connectorConnections").get(connectionId)
          ).pipe(Effect.orDie)
        );
        expect(quiet.nextSyncAt).toBe(TENANCY_NOW + 3 * 3_600_000);
        yield* admin.mutation(classroom.link, {
          classId: null,
          connectionId,
          courseId: "c1",
          slug: nf,
        });
        yield* admin.mutation(classroom.link, {
          classId: null,
          connectionId,
          courseId: "c1",
          slug: nf,
        });
        expect(
          yield* fixture.internal.mutation(
            refs.internal.connectors.classroom.storeWork,
            {
              connectionId,
              courseId: "c1",
              works: [],
            }
          )
        ).toEqual({ changed: false });
      })
  );

  it.effect(
    "refuses a link to a connection or a class of another kind or school as missing, and moves a refused token to reconnect",
    () =>
      Effect.gen(function* () {
        const { classId, connectionId, fixture } = yield* school;
        const admin = fixture.as("admin");
        const drive = yield* fixture.run(
          connect(
            { id: fixture.people.teacher.personId, kind: "person" },
            { kind: "tenant", tenantId: fixture.tenants.nf },
            {
              connector: "drive",
              googleSubject: null,
              refreshToken: "refresh-drive",
              scopes: ["openid"],
            }
          )
        );
        expect(
          yield* admin
            .mutation(classroom.link, {
              classId,
              connectionId: drive,
              courseId: "c1",
              slug: nf,
            })
            .pipe(Effect.flip)
        ).toMatchObject(denied("resource"));
        const foreign = yield* writeClass(
          fixture,
          fixture.units.smp,
          "kelas-lain",
          "active",
          "active"
        );
        yield* fixture.run(
          Effect.flatMap(DatabaseWriter, (writer) =>
            writer
              .table("classes")
              .patch(foreign, { tenantId: fixture.tenants.other })
          ).pipe(Effect.orDie)
        );
        expect(
          yield* admin
            .mutation(classroom.link, {
              classId: foreign,
              connectionId,
              courseId: "c1",
              slug: nf,
            })
            .pipe(Effect.flip)
        ).toMatchObject(denied("resource"));
        expect(
          yield* fixture.internal.query(
            refs.internal.connectors.classroom.target,
            {
              slug: slugOf("tidak-ada"),
            }
          )
        ).toBeNull();
        fetcher.mockResolvedValue(json(400, { error: "invalid_grant" }));
        expect(
          yield* admin.action(classroom.preview, { slug: nf }).pipe(Effect.flip)
        ).toMatchObject({ reason: "revoked" });
        const row = yield* fixture.run(
          Effect.flatMap(DatabaseReader, (reader) =>
            reader.table("connectorConnections").get(connectionId)
          ).pipe(Effect.orDie)
        );
        expect(row.status).toBe("reconnect");
        expect(yield* admin.action(classroom.preview, { slug: nf })).toBeNull();
        const fresh = yield* fixture.run(
          connect(
            { id: fixture.people.teacher.personId, kind: "person" },
            { kind: "tenant", tenantId: fixture.tenants.nf },
            {
              connector: "classroom",
              googleSubject: "teacher-subject-2",
              refreshToken: "refresh-2",
              scopes: ["openid"],
            }
          )
        );
        yield* fixture.run(
          Effect.gen(function* () {
            const secret = yield* (yield* DatabaseReader)
              .table("connectorSecrets")
              .index("by_connectionId", (query) =>
                query.eq("connectionId", fresh)
              )
              .first();
            if (secret._tag === "Some") {
              yield* (yield* DatabaseWriter)
                .table("connectorSecrets")
                .delete(secret.value._id);
            }
          }).pipe(Effect.orDie)
        );
        expect(
          yield* fixture.internal.query(
            refs.internal.connectors.classroom.target,
            {
              slug: nf,
            }
          )
        ).toBeNull();
      })
  );
});
