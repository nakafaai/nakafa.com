import type { GenericId } from "@confect/core";
import { beforeEach, describe, expect, it } from "@effect/vitest";
import { components } from "@repo/backend/confect/_generated/components";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseWriter,
  MutationCtx,
} from "@repo/backend/confect/_generated/services";
import {
  EDITOR_LIMIT,
  PRESENCE_INTERVAL,
} from "@repo/backend/confect/exams/presence";
import { denied, nf, otherSchoolTeacher } from "@repo/backend/test/editor";
import { archiveUnit, teacherExam } from "@repo/backend/test/exams";
import { MASCOT } from "@repo/backend/test/mascot";
import {
  tenancyFixture as fixtureOf,
  TENANCY_NOW,
  type tenancyFixture,
} from "@repo/backend/test/tenancy";
import { Array as Arr, Duration, Effect } from "effect";

const { join, leave, list } = refs.public.exams.presence;

/** The fixture the presence tests seed. */
type Fixture = Effect.Success<typeof tenancyFixture>;

/** The accounts of the school that join or read a room in these tests. */
type Actor = "admin" | "principal" | "student" | "teacher" | "unitAdmin";

/** How long the component keeps a silent session: 2.5 heartbeat intervals. */
const TIMEOUT = Duration.toMillis(PRESENCE_INTERVAL) * 2.5;

/** The teacher's exam, which the school's Admin may edit too. */
const sharedExam = (fixture: Fixture) =>
  teacherExam(fixture, "PTS").pipe(Effect.map((exam) => exam.id));

/** Joins one account's session to the exam's room. */
const joinAs = (
  fixture: Fixture,
  actor: Actor,
  examId: GenericId.GenericId<"exams">,
  session: string
) => fixture.as(actor).mutation(join, { examId, session, slug: nf });

/** The other editors in the exam's room, read as one account. */
const editorsOf = (
  fixture: Fixture,
  actor: Actor,
  examId: GenericId.GenericId<"exams">
) => fixture.as(actor).query(list, { examId, slug: nf });

/** The names of the other editors in the room, read as one account. */
const namesOf = (
  fixture: Fixture,
  actor: Actor,
  examId: GenericId.GenericId<"exams">
) =>
  editorsOf(fixture, actor, examId).pipe(
    Effect.map(Arr.map((editor) => editor.name))
  );

describe("exams/presence", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TENANCY_NOW);
  });

  it.effect(
    "shows each editor the others in the exam with their name and animal, and never themselves",
    () =>
      Effect.gen(function* () {
        const fixture = yield* fixtureOf;
        const examId = yield* sharedExam(fixture);
        yield* joinAs(fixture, "teacher", examId, "teacher-tab");
        expect(yield* editorsOf(fixture, "teacher", examId)).toEqual([]);
        yield* joinAs(fixture, "admin", examId, "admin-tab");
        expect(yield* editorsOf(fixture, "teacher", examId)).toEqual([
          { id: fixture.people.admin.personId, mascot: MASCOT, name: "Admin" },
        ]);
        expect(yield* editorsOf(fixture, "admin", examId)).toEqual([
          {
            id: fixture.people.teacher.personId,
            mascot: MASCOT,
            name: "Teacher",
          },
        ]);
      })
  );

  it.effect(
    "shows the photo of an editor whose account shows it, and keeps an editor in two tabs once until both leave",
    () =>
      Effect.gen(function* () {
        const fixture = yield* fixtureOf;
        const examId = yield* sharedExam(fixture);
        yield* fixture.run(
          Effect.flatMap(DatabaseWriter, (writer) =>
            writer.table("users").patch(fixture.users.admin.userId, {
              image: "https://example.com/admin.png",
              picture: "photo",
            })
          ).pipe(Effect.orDie)
        );
        const first = yield* joinAs(fixture, "admin", examId, "admin-first");
        const second = yield* joinAs(fixture, "admin", examId, "admin-second");
        expect(yield* editorsOf(fixture, "teacher", examId)).toEqual([
          {
            id: fixture.people.admin.personId,
            image: "https://example.com/admin.png",
            mascot: MASCOT,
            name: "Admin",
          },
        ]);
        expect(
          yield* fixture.as("admin").mutation(leave, { token: first.token })
        ).toBeNull();
        expect(yield* namesOf(fixture, "teacher", examId)).toEqual(["Admin"]);
        yield* fixture.anonymous.mutation(leave, { token: second.token });
        expect(yield* namesOf(fixture, "teacher", examId)).toEqual([]);
      })
  );

  it.effect(
    "keeps one join's session on each heartbeat, and closes a session that stops for 2.5 intervals",
    () =>
      Effect.gen(function* () {
        const fixture = yield* fixtureOf;
        const examId = yield* sharedExam(fixture);
        const joined = yield* joinAs(fixture, "admin", examId, "admin-tab");
        yield* fixture.advanceScheduled(Duration.toMillis(PRESENCE_INTERVAL));
        const again = yield* joinAs(fixture, "admin", examId, "admin-tab");
        expect(again.token).toBe(joined.token);
        yield* fixture.advanceScheduled(TIMEOUT - 1000);
        expect(yield* namesOf(fixture, "teacher", examId)).toEqual(["Admin"]);
        yield* fixture.advanceScheduled(2000);
        yield* fixture.finishScheduled();
        expect(yield* namesOf(fixture, "teacher", examId)).toEqual([]);
      })
  );

  it.effect("closes nothing for a token that names no session", () =>
    Effect.gen(function* () {
      const fixture = yield* fixtureOf;
      const examId = yield* sharedExam(fixture);
      yield* joinAs(fixture, "admin", examId, "admin-tab");
      expect(
        yield* fixture.anonymous.mutation(leave, { token: "no-such-token" })
      ).toBeNull();
      expect(yield* namesOf(fixture, "teacher", examId)).toEqual(["Admin"]);
    })
  );

  it.effect(
    "leaves out an editor the school removed, or whose account was deleted, while their session is still open",
    () =>
      Effect.gen(function* () {
        const fixture = yield* fixtureOf;
        const examId = yield* sharedExam(fixture);
        yield* joinAs(fixture, "admin", examId, "admin-tab");
        yield* joinAs(fixture, "unitAdmin", examId, "unit-admin-tab");
        expect(yield* namesOf(fixture, "teacher", examId)).toEqual([
          "Admin",
          "Unit Admin",
        ]);
        yield* fixture.run(
          Effect.gen(function* () {
            const people = (yield* DatabaseWriter).table("tenantPeople");
            yield* people.patch(fixture.people.admin.personId, {
              account: { state: "unclaimed" },
            });
            yield* people.patch(fixture.people.unitAdmin.personId, {
              status: "removed",
            });
          }).pipe(Effect.orDie)
        );
        expect(yield* namesOf(fixture, "teacher", examId)).toEqual([]);
      })
  );

  it.effect(
    "lists at most the limit of other editors, and the caller takes none of the places",
    () =>
      Effect.gen(function* () {
        const fixture = yield* fixtureOf;
        const examId = yield* sharedExam(fixture);
        yield* joinAs(fixture, "teacher", examId, "teacher-tab");
        yield* fixture.run(
          Effect.gen(function* () {
            const writer = yield* DatabaseWriter;
            const ctx = yield* MutationCtx;
            yield* Effect.forEach(
              Arr.makeBy(EDITOR_LIMIT + 1, (index) => index),
              (index) =>
                Effect.gen(function* () {
                  const userId = yield* writer.table("users").insert({
                    authId: `editor-${index}`,
                    credits: 0,
                    creditsResetAt: 0,
                    email: `editor-${index}@example.com`,
                    mascot: MASCOT,
                    name: `Editor ${index}`,
                    plan: "free",
                  });
                  const personId = yield* writer.table("tenantPeople").insert({
                    account: {
                      claimedAt: TENANCY_NOW,
                      method: "invite",
                      state: "claimed",
                      userId,
                    },
                    kind: "member",
                    name: `Editor ${index}`,
                    status: "active",
                    tenantId: fixture.tenants.nf,
                  });
                  yield* Effect.promise(() =>
                    ctx.runMutation(components.presence.public.heartbeat, {
                      interval: Duration.toMillis(PRESENCE_INTERVAL),
                      roomId: examId,
                      sessionId: `editor-${index}`,
                      userId: personId,
                    })
                  );
                }),
              { discard: true }
            );
          })
        );
        const names = yield* namesOf(fixture, "teacher", examId);
        expect(names).toHaveLength(EDITOR_LIMIT);
        expect(Arr.contains(names, "Teacher")).toBe(false);
      })
  );

  it.effect(
    "refuses the room to a member who may not edit the exam, to another school, and to an archived unit's exam",
    () =>
      Effect.gen(function* () {
        const fixture = yield* fixtureOf;
        const examId = yield* sharedExam(fixture);
        const student = yield* joinAs(
          fixture,
          "student",
          examId,
          "student-tab"
        ).pipe(Effect.flip);
        const principal = yield* editorsOf(fixture, "principal", examId).pipe(
          Effect.flip
        );
        const foreign = yield* (yield* otherSchoolTeacher(fixture))
          .mutation(join, { examId, session: "foreign-tab", slug: nf })
          .pipe(Effect.flip);
        expect([student, principal]).toMatchObject([
          denied("role"),
          denied("role"),
        ]);
        expect(foreign).toMatchObject({ _tag: "NotMember" });
        yield* fixture.run(archiveUnit(fixture.units.smp));
        const archivedJoin = yield* joinAs(
          fixture,
          "teacher",
          examId,
          "teacher-tab"
        ).pipe(Effect.flip);
        const archivedList = yield* editorsOf(fixture, "teacher", examId).pipe(
          Effect.flip
        );
        expect([archivedJoin, archivedList]).toMatchObject([
          denied("condition"),
          denied("condition"),
        ]);
      })
  );
});
