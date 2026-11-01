import { beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { practiceOf } from "@repo/backend/confect/insight/practice";
import { PracticeTopic } from "@repo/backend/confect/insight/schema";
import tryoutAttempts from "@repo/backend/confect/tables/tryoutAttempts";
import tryoutSetProgress from "@repo/backend/confect/tables/tryoutSetProgress";
import {
  forumClass,
  keyedFixture,
  nf,
  period,
} from "@repo/backend/test/classroom";
import { TENANCY_NOW, type tenancyFixture } from "@repo/backend/test/tenancy";
import { Effect, Schema } from "effect";

type Fixture = Effect.Success<typeof tenancyFixture>;

const { share, stop, topics } = refs.public.insight.practice;
const { ofClass } = refs.public.insight.reads;

const TOPIC = Schema.decodeUnknownSync(PracticeTopic)({
  countryKey: "indonesia",
  examKey: "snbt",
  trackKey: "2027",
});

/** What a finished attempt stores, apart from its learner and its set. */
const ATTEMPT = {
  ...TOPIC,
  accessEndsAt: TENANCY_NOW + 1000,
  accessSourceKind: "free",
  appLocale: "id",
  assessmentSnapshotId: "snapshot",
  attemptNumber: 1,
  completedAt: TENANCY_NOW,
  completedSectionKeys: [],
  countsForCompetition: false,
  endReason: "submitted",
  expiresAt: TENANCY_NOW + 1000,
  lastActivityAt: TENANCY_NOW,
  paper: { hash: `sha256:${"2".repeat(64)}`, id: "test-paper" },
  profile: { hash: `sha256:${"3".repeat(64)}`, id: "test-profile" },
  releaseId: "release",
  scoreStatus: "official",
  scoring: { kind: "raw" },
  sections: [],
  setPublicPath: "try-out/indonesia/snbt/2027/set-1",
  startedAt: TENANCY_NOW - 1000,
  status: "completed",
  totalCorrect: 8,
  totalQuestions: 10,
};

/** A finished attempt of one set, as the try-out writes it. */
const attemptOf = (setKey: string, userId: string) =>
  Schema.decodeUnknownSync(tryoutAttempts.Fields)({
    ...ATTEMPT,
    setIdentity: setKey,
    setKey,
    userId,
  });

/** The progress of one set, as the try-out keeps it. */
const progressOf = (
  setKey: string,
  userId: string,
  latestAttemptId: string,
  publishedScore: number | null
) =>
  Schema.decodeUnknownSync(tryoutSetProgress.Fields)({
    ...TOPIC,
    appLocale: "id",
    attemptNumber: 1,
    latestAttemptId,
    publishedScore,
    setIdentity: setKey,
    setKey,
    status: "completed",
    statusRank: 3,
    updatedAt: TENANCY_NOW,
    userId,
  });

/** Stores one set of the student's private practice. */
const practiced = (
  fixture: Fixture,
  setKey: string,
  publishedScore: number | null
) =>
  fixture.run(
    Effect.gen(function* () {
      const student = yield* (yield* DatabaseReader)
        .table("tenantPeople")
        .get(fixture.people.student.personId);
      if (student.account.state !== "claimed") {
        return yield* Effect.die("The student has an account.");
      }
      const writer = yield* DatabaseWriter;
      const { userId } = student.account;
      const attempt = yield* writer
        .table("tryoutAttempts")
        .insert(attemptOf(setKey, userId));
      yield* writer
        .table("tryoutSetProgress")
        .insert(progressOf(setKey, userId, attempt, publishedScore));
    }).pipe(Effect.orDie)
  );

describe("insight/practice", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(TENANCY_NOW);
  });

  it.effect(
    "keeps practice from the teacher until the student shares its topic, and takes it back",
    () =>
      Effect.gen(function* () {
        const fixture = yield* keyedFixture;
        const term = yield* period(fixture, fixture.units.smp);
        const forum = yield* forumClass(fixture, term.id, "X-1");
        yield* practiced(fixture, "set-1", 600);
        yield* practiced(fixture, "set-2", 800);
        yield* practiced(fixture, "set-3", null);
        const student = fixture.as("student");
        const seen = () =>
          fixture
            .as("teacher")
            .query(ofClass, { classId: forum.classId, slug: nf })
            .pipe(Effect.map((view) => view.students[0]?.practice));

        expect(yield* student.query(topics, { slug: nf })).toEqual([
          { ...TOPIC, mean: 700, sets: 2, shared: false },
        ]);
        expect(yield* seen()).toEqual([]);

        yield* student.mutation(share, { ...TOPIC, slug: nf });
        yield* student.mutation(share, { ...TOPIC, slug: nf });
        expect(yield* student.query(topics, { slug: nf })).toMatchObject([
          { shared: true },
        ]);
        expect(yield* seen()).toEqual([{ ...TOPIC, mean: 700, sets: 2 }]);

        yield* student.mutation(stop, { ...TOPIC, slug: nf });
        yield* student.mutation(stop, { ...TOPIC, slug: nf });
        expect(yield* seen()).toEqual([]);
      })
  );

  it.effect("finds no practice for a Person with no account", () =>
    Effect.gen(function* () {
      const fixture = yield* keyedFixture;
      const found = yield* fixture.run(
        Effect.gen(function* () {
          const personId = yield* (yield* DatabaseWriter)
            .table("tenantPeople")
            .insert({
              account: { state: "unclaimed" },
              kind: "member",
              name: "Tamu",
              status: "active",
              tenantId: fixture.tenants.nf,
            });
          const person = yield* (yield* DatabaseReader)
            .table("tenantPeople")
            .get(personId);
          return yield* practiceOf(person);
        }).pipe(Effect.orDie)
      );
      expect(found).toEqual([]);
    })
  );
});
