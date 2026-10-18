import type { GenericId } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { encodeKey } from "@repo/backend/confect/exams/question";
import type { EnterOutcome } from "@repo/backend/confect/exams/sittings/contract";
import {
  RoomName,
  SittingGroup,
} from "@repo/backend/confect/exams/sittings/schema";
import { createTenantKey } from "@repo/backend/confect/vault/keys";
import { nf } from "@repo/backend/test/editor";
import { teacherExam } from "@repo/backend/test/exams";
import { TENANCY_NOW, type tenancyFixture } from "@repo/backend/test/tenancy";
import { Array as Arr, Effect, Predicate, Record, Schema } from "effect";

/**
 * Whether any string inside a returned value contains the text. A read must never
 * return a token or its hash, so a test checks every string the reply holds.
 */
export const mentions = (value: unknown, text: string): boolean => {
  if (Predicate.isString(value)) {
    return value.includes(text);
  }
  if (Arr.isArray(value)) {
    return Arr.some(value, (item) => mentions(item, text));
  }
  if (Predicate.isObject(value)) {
    return Arr.some(Record.values(value), (item) => mentions(item, text));
  }
  return false;
};

/** The fixture the sitting tests seed. */
export type SittingFixture = Effect.Success<typeof tenancyFixture>;

/** The reply of an entry, as the entry function returns it. */
type EnterReply = typeof EnterOutcome.Type;

/**
 * The admitted reply of an entry, for a test that expects admission. A refused entry
 * fails the test, and the reply's type narrows to the admitted member, so the test can
 * read its attempt.
 */
export const admittedOf = Effect.fn("test.sittings.admittedOf")(function* (
  reply: EnterReply
) {
  if (reply.outcome === "refused") {
    return yield* Effect.die(`the entry was refused: ${reply.reason}`);
  }
  return reply;
});

/** The people who enter a sitting or read its dashboard in the tests. */
type Actor = "student" | "teacher" | "deputy";

/** One entry of a person into a sitting, with the device and token that the test gives. */
export const entryOf = (
  fixture: SittingFixture,
  args: {
    deviceId: string;
    sittingId: GenericId.GenericId<"examSittings">;
    token: string;
  },
  actor: Actor = "student"
) =>
  fixture
    .as(actor)
    .mutation(refs.public.exams.sittings.enter, { ...args, slug: nf });

/** An entry that the test expects to admit, with the admitted reply narrowed. */
export const enterOk = (
  fixture: SittingFixture,
  args: Parameters<typeof entryOf>[1],
  actor: Actor = "student"
) => entryOf(fixture, args, actor).pipe(Effect.flatMap(admittedOf));

/** One page of a sitting's dashboard, read by the teacher. */
export const dashboardOf = (
  fixture: SittingFixture,
  sittingId: GenericId.GenericId<"examSittings">
) =>
  fixture.as("teacher").query(refs.public.exams.sittings.dashboard, {
    paginationOpts: { cursor: null, numItems: 10 },
    sittingId,
    slug: nf,
  });

/** A sitting in the tests opens one minute after the test starts, and closes an hour after it. */
export const OPENS_AT = TENANCY_NOW + 60_000;
export const CLOSES_AT = TENANCY_NOW + 3_600_000;

/** A device UUID for the n-th device of a test, so each device is distinct. */
export const deviceOf = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

/** Gives the test school its key, as provisioning gives every school one. */
export const keyedSchool = Effect.fn("test.sittings.keyedSchool")(function* (
  fixture: SittingFixture
) {
  yield* fixture.run(createTenantKey(fixture.tenants.nf));
});

/**
 * A teacher's exam with one question whose correct answer is marked, so the exam can
 * be scheduled. Returns the exam's ID.
 */
export const keyedExam = Effect.fn("test.sittings.keyedExam")(function* (
  fixture: SittingFixture,
  title: string
) {
  const exam = yield* teacherExam(fixture, title);
  yield* fixture.run(
    Effect.asVoid(
      Effect.forEach(exam.questions, (question) =>
        Effect.gen(function* () {
          const [interaction] = question.answers;
          if (interaction.kind !== "choice") {
            return yield* Effect.die("the questions of the tests are choices");
          }
          const [option] = interaction.options;
          const key = yield* encodeKey([
            {
              correct: [option.id],
              interaction: interaction.id,
              kind: "choice",
            },
          ]);
          yield* (yield* DatabaseWriter)
            .table("examQuestions")
            .patch(question.id, { key });
        })
      )
    )
  );
  return exam.id;
});

/** The arguments of a test's schedule, and the account that makes it (the teacher by default). */
const ScheduleSittingArgs = Schema.Struct({
  actor: Schema.optionalKey(Schema.Literals(["admin", "teacher", "student"])),
  closesAt: Schema.Finite,
  examId: Id("exams"),
  group: SittingGroup,
  opensAt: Schema.Finite,
  room: Schema.optionalKey(RoomName),
});

/** Schedules a sitting as the given account, which by default is the teacher. */
export const scheduleSitting = Effect.fn("test.sittings.schedule")(function* (
  fixture: SittingFixture,
  args: typeof ScheduleSittingArgs.Type
) {
  return yield* fixture
    .as(args.actor ?? "teacher")
    .mutation(refs.public.exams.exams.schedule, {
      closesAt: args.closesAt,
      examId: args.examId,
      group: args.group,
      opensAt: args.opensAt,
      room: args.room ?? "Lab 2",
      slug: nf,
    });
});

/**
 * Schedules a unit sitting of a keyed exam in the SMP unit, and opens it at its opening
 * time the way the scheduler would. Returns the sitting's ID and its token.
 */
export const openedSitting = Effect.fn("test.sittings.opened")(function* (
  fixture: SittingFixture,
  title: string
) {
  yield* keyedSchool(fixture);
  const examId = yield* keyedExam(fixture, title);
  const made = yield* scheduleSitting(fixture, {
    closesAt: CLOSES_AT,
    examId,
    group: { kind: "unit", unitId: fixture.units.smp },
    opensAt: OPENS_AT,
  });
  vi.setSystemTime(OPENS_AT);
  yield* fixture.internal.mutation(refs.internal.exams.sittings.timers.open, {
    sittingId: made.id,
  });
  return made;
});

/** Reads one sitting row, to check its state, deadline, or jobs. */
export const sittingRow = (
  fixture: SittingFixture,
  sittingId: GenericId.GenericId<"examSittings">
) =>
  fixture.run(
    Effect.flatMap(DatabaseReader, (reader) =>
      reader.table("examSittings").get(sittingId).pipe(Effect.orDie)
    )
  );

/** Reads one attempt row. */
export const attemptRow = (
  fixture: SittingFixture,
  attemptId: GenericId.GenericId<"examAttempts">
) =>
  fixture.run(
    Effect.flatMap(DatabaseReader, (reader) =>
      reader.table("examAttempts").get(attemptId).pipe(Effect.orDie)
    )
  );

/**
 * Seeds a cohort of the SMP unit, with one period and one placement of the Person, and
 * returns the cohort's ID.
 */
export const seedPlacement = Effect.fn("test.sittings.placement")(function* (
  fixture: SittingFixture,
  personId: GenericId.GenericId<"tenantPeople">
) {
  return yield* fixture.run(
    Effect.gen(function* () {
      const writer = yield* DatabaseWriter;
      const periodId = yield* writer.table("tenantPeriods").insert({
        end: "2026-12-19",
        name: "Ganjil",
        start: "2026-07-13",
        status: "active",
        tenantId: fixture.tenants.nf,
        unitId: fixture.units.smp,
      });
      const cohortId = yield* writer.table("tenantCohorts").insert({
        grade: 10,
        name: "10A",
        nameKey: "10a",
        periodId,
        status: "active",
        tenantId: fixture.tenants.nf,
        unitId: fixture.units.smp,
      });
      yield* writer.table("tenantCohortMembers").insert({
        cohortId,
        periodId,
        personId,
        tenantId: fixture.tenants.nf,
      });
      return cohortId;
    })
  );
});

/**
 * Seeds an attempt directly, for a Person who never enters in the test: an attempt in a
 * given state, with a given deadline and device, so a test starts from that state.
 */
export const seedAttempt = (
  fixture: SittingFixture,
  args: {
    deadline: number;
    deviceId: string | null;
    person: GenericId.GenericId<"tenantPeople">;
    sittingId: GenericId.GenericId<"examSittings">;
    state: "inProgress" | "locked" | "closing";
  }
) =>
  fixture.run(
    Effect.flatMap(DatabaseWriter, (writer) =>
      writer.table("examAttempts").insert({
        deadline: args.deadline,
        deviceId: args.deviceId,
        person: args.person,
        retiredDeviceIds: [],
        sitting: args.sittingId,
        startedAt: args.deadline,
        state: args.state,
        tenantId: fixture.tenants.nf,
      })
    )
  );

/** Records one integrity signal for an attempt, as a test's own event. */
export const seedSignal = (
  fixture: SittingFixture,
  args: {
    at: number;
    attemptId: GenericId.GenericId<"examAttempts">;
    kind: "exit" | "return" | "disconnect" | "blur";
  }
) =>
  fixture.run(
    Effect.flatMap(DatabaseWriter, (writer) =>
      writer.table("examSignals").insert({
        at: args.at,
        attempt: args.attemptId,
        kind: args.kind,
        tenantId: fixture.tenants.nf,
      })
    )
  );
