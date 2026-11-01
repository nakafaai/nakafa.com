import { beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { SCHEDULED_LIMIT } from "@repo/backend/confect/classroom/posts/scheduled";
import {
  denied,
  firstPage,
  forumClass,
  keyedFixture,
  nf,
  period,
} from "@repo/backend/test/classroom";
import { TENANCY_NOW } from "@repo/backend/test/tenancy";
import { encodeJsonText } from "@repo/utilities/json";
import { Array as Arr, Effect } from "effect";

const { cancel, edit, list, schedule } = refs.public.classroom.scheduled;
const { release } = refs.internal.classroom.scheduled;
const posts = refs.public.classroom.posts;

const HOUR = 3_600_000;

/** A class with a teacher who keeps one announcement for an hour from now. */
const waiting = Effect.gen(function* () {
  const fixture = yield* keyedFixture;
  const term = yield* period(fixture, fixture.units.smp);
  const forum = yield* forumClass(fixture, term.id, "X-1");
  const scope = { classId: forum.classId, slug: nf };
  const teacher = fixture.as("teacher");
  const kept = yield* teacher.mutation(schedule, {
    ...scope,
    clientKey: "kept-for-later",
    email: false,
    publishAt: TENANCY_NOW + HOUR,
    text: "Ulangan besok.",
  });
  return { fixture, kept, scope, teacher, term };
});

/** The announcements the class reads, by text. */
const read = (
  fixture: Effect.Success<typeof waiting>["fixture"],
  scope: Effect.Success<typeof waiting>["scope"]
) =>
  fixture
    .as("student")
    .query(posts.list, { ...firstPage, ...scope })
    .pipe(Effect.map(({ page }) => Arr.map(page, (post) => post.text)));

describe("classroom/scheduled", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TENANCY_NOW);
  });

  it.effect(
    "keeps an announcement from the class until its time, once for a client key, and then posts it",
    () =>
      Effect.gen(function* () {
        const { fixture, kept, scope, teacher } = yield* waiting;
        expect(kept.text).toBe("Ulangan besok.");
        expect(
          yield* teacher.mutation(schedule, {
            ...scope,
            clientKey: "kept-for-later",
            email: false,
            publishAt: TENANCY_NOW + HOUR,
            text: "Ulangan besok.",
          })
        ).toEqual(kept);
        expect(yield* teacher.query(list, scope)).toEqual([kept]);
        expect(yield* read(fixture, scope)).toEqual([]);
        expect(
          encodeJsonText(
            yield* fixture.run(
              Effect.flatMap(DatabaseReader, (reader) =>
                reader
                  .table("classroomScheduled")
                  .index("by_creation_time")
                  .take(5)
              )
            )
          )
        ).not.toContain("Ulangan");

        yield* Effect.promise(() =>
          fixture.convex.finishAllScheduledFunctions(vi.runAllTimers)
        );
        expect(yield* read(fixture, scope)).toEqual(["Ulangan besok."]);
        expect(yield* teacher.query(list, scope)).toEqual([]);
      })
  );

  it.effect(
    "moves and rewrites a waiting announcement, and a cancelled one never posts",
    () =>
      Effect.gen(function* () {
        const { fixture, kept, scope, teacher } = yield* waiting;
        const moved = yield* teacher.mutation(edit, {
          ...scope,
          publishAt: TENANCY_NOW + 2 * HOUR,
          scheduledId: kept.id,
          text: "Ulangan lusa.",
        });
        expect(moved).toMatchObject({
          publishAt: TENANCY_NOW + 2 * HOUR,
          text: "Ulangan lusa.",
        });
        expect(
          yield* teacher.mutation(cancel, { ...scope, scheduledId: kept.id })
        ).toBeNull();
        yield* Effect.promise(() =>
          fixture.convex.finishAllScheduledFunctions(vi.runAllTimers)
        );
        expect(yield* read(fixture, scope)).toEqual([]);
      })
  );

  it.effect("posts nothing for a run that outlives its cancel", () =>
    Effect.gen(function* () {
      const { fixture, kept, scope, teacher } = yield* waiting;
      yield* teacher.mutation(cancel, { ...scope, scheduledId: kept.id });
      expect(
        yield* fixture.internal.mutation(release, {
          classId: scope.classId,
          clientKey: kept.clientKey,
        })
      ).toBeNull();
      expect(yield* read(fixture, scope)).toEqual([]);
    })
  );

  it.effect(
    "refuses a student, a past time, another class, and a class that holds the most it can",
    () =>
      Effect.gen(function* () {
        const { fixture, kept, scope, teacher, term } = yield* waiting;
        const other = yield* forumClass(fixture, term.id, "X-2", false);
        const draft = {
          ...scope,
          email: false,
          publishAt: TENANCY_NOW + HOUR,
          text: "Lagi",
        };
        const refusals = yield* Effect.all([
          fixture
            .as("student")
            .mutation(schedule, { ...draft, clientKey: "from-a-student" })
            .pipe(Effect.flip),
          teacher
            .mutation(schedule, {
              ...draft,
              clientKey: "in-the-past",
              publishAt: TENANCY_NOW - 1,
            })
            .pipe(Effect.flip),
          teacher
            .mutation(edit, {
              ...scope,
              publishAt: TENANCY_NOW - 1,
              scheduledId: kept.id,
              text: "Lagi",
            })
            .pipe(Effect.flip),
          teacher
            .mutation(cancel, {
              classId: other.classId,
              scheduledId: kept.id,
              slug: nf,
            })
            .pipe(Effect.flip),
        ]);
        expect(refusals).toMatchObject([
          denied("role"),
          { _tag: "ScheduledPast" },
          { _tag: "ScheduledPast" },
          denied("resource"),
        ]);

        yield* Effect.forEach(
          Arr.range(2, SCHEDULED_LIMIT),
          (index) =>
            teacher.mutation(schedule, {
              ...draft,
              clientKey: `kept-post-${index}`,
            }),
          { discard: true }
        );
        expect(
          yield* teacher
            .mutation(schedule, { ...draft, clientKey: "one-too-many" })
            .pipe(Effect.flip)
        ).toMatchObject({ _tag: "ScheduledLimit" });
      }),
    { timeout: 30_000 }
  );
});
