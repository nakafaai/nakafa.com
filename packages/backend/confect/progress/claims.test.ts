import { describe, expect, it } from "@effect/vitest";
import progress from "@repo/backend/confect/_generated/refs/progress";
import { FIXTURE_TRACK } from "@repo/backend/test/assessment/catalog";
import { tryoutWorld } from "@repo/backend/test/tryout/world";
import { Effect } from "effect";

const identity = { ...FIXTURE_TRACK, locale: "id" as const, setKey: "set-1" };

describe("progress/claims", () => {
  it.effect(
    "answers the set's section grants and its own grant as the learner earns them, and nothing for a visitor",
    () =>
      Effect.gen(function* () {
        const world = yield* tryoutWorld();
        expect(
          yield* world.visitor.query(progress.queries.claims, identity)
        ).toBeNull();
        expect(
          yield* world.learner.query(progress.queries.claims, identity)
        ).toEqual({ sections: [], set: false, stars: 0 });

        const { attemptId } = yield* world.start();
        yield* world.startSection(attemptId, "section-a");
        yield* world.answer(attemptId, {
          order: 1,
          pick: "correct",
          section: "section-a",
        });
        yield* world.completeSection(attemptId, "section-a");
        expect(
          yield* world.learner.query(progress.queries.claims, identity)
        ).toEqual({ sections: ["section-a"], set: false, stars: 15 });

        yield* world.startSection(attemptId, "section-b");
        yield* world.completeSection(attemptId, "section-b");
        expect(
          yield* world.learner.query(progress.queries.claims, identity)
        ).toEqual({ sections: ["section-a"], set: true, stars: 55 });
        // Another set of the track holds none of them.
        expect(
          yield* world.learner.query(progress.queries.claims, {
            ...identity,
            setKey: "set-10",
          })
        ).toEqual({ sections: [], set: false, stars: 0 });
      })
  );
});
