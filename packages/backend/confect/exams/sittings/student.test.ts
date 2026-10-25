import { beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import { nf } from "@repo/backend/test/editor";
import {
  deviceOf,
  enterOk,
  mentions,
  openedSitting,
} from "@repo/backend/test/sittings";
import { TENANCY_NOW, tenancyFixture } from "@repo/backend/test/tenancy";
import { Effect } from "effect";

const { close, finish, student } = refs.public.exams.sittings;

describe("exams/sittings student", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TENANCY_NOW);
  });

  it.effect(
    "shows a student an open sitting they may enter, with no attempt yet and no token",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const made = yield* openedSitting(fixture, "PTS");
        const view = yield* fixture
          .as("student")
          .query(student, { sittingId: made.id, slug: nf });
        expect(view).toMatchObject({
          attempt: null,
          sitting: { examTitle: "PTS", id: made.id, room: "Lab 2" },
        });
        expect(mentions(view, made.token)).toBe(false);
      })
  );

  it.effect(
    "keeps showing a student's attempt after the proctor closes the sitting",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const made = yield* openedSitting(fixture, "PTS");
        const entered = yield* enterOk(fixture, {
          deviceId: deviceOf(1),
          sittingId: made.id,
          token: made.token,
        });
        yield* fixture
          .as("teacher")
          .mutation(close, { sittingId: made.id, slug: nf });
        expect(
          yield* fixture
            .as("student")
            .query(student, { sittingId: made.id, slug: nf })
        ).toMatchObject({
          attempt: { id: entered.attempt },
          sitting: { id: made.id, state: "closed" },
        });
      })
  );

  it.effect(
    "keeps showing a student's attempt after the student finishes",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const made = yield* openedSitting(fixture, "PTS");
        yield* enterOk(fixture, {
          deviceId: deviceOf(1),
          sittingId: made.id,
          token: made.token,
        });
        yield* fixture.as("student").mutation(finish, {
          deviceId: deviceOf(1),
          sittingId: made.id,
          slug: nf,
        });
        expect(
          yield* fixture
            .as("student")
            .query(student, { sittingId: made.id, slug: nf })
        ).toMatchObject({
          attempt: { state: "submitted" },
          sitting: { id: made.id, state: "open" },
        });
      })
  );

  it.effect(
    "refuses a closed sitting to a student who holds no attempt in it",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const made = yield* openedSitting(fixture, "PTS");
        yield* fixture
          .as("teacher")
          .mutation(close, { sittingId: made.id, slug: nf });
        const refused = yield* fixture
          .as("student")
          .query(student, { sittingId: made.id, slug: nf })
          .pipe(Effect.flip);
        expect(refused).toMatchObject({ _tag: "NotInSitting" });
      })
  );

  it.effect("refuses an open sitting to a member who may not enter it", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const made = yield* openedSitting(fixture, "PTS");
      const refused = yield* fixture
        .as("teacher")
        .query(student, { sittingId: made.id, slug: nf })
        .pipe(Effect.flip);
      expect(refused).toMatchObject({ _tag: "NotInSitting" });
    })
  );

  it.effect("does not show a student a sitting of another school", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const made = yield* openedSitting(fixture, "PTS");
      yield* fixture.run(
        Effect.flatMap(DatabaseWriter, (writer) =>
          writer
            .table("examSittings")
            .patch(made.id, { tenantId: fixture.tenants.other })
            .pipe(Effect.orDie)
        )
      );
      const failure = yield* fixture
        .as("student")
        .query(student, { sittingId: made.id, slug: nf })
        .pipe(Effect.flip);
      expect(failure).toMatchObject({ _tag: "NotInSitting" });
    })
  );
});
