import { assert, describe, expect, it } from "@effect/vitest";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import {
  indexTryoutResponses,
  validateTryoutResponsePlacementInventory,
  validateTryoutSections,
} from "@repo/backend/confect/tryouts/response/integrity";
import { seedTryoutGate } from "@repo/backend/test/tryout/gate";
import { Effect } from "effect";

/** The seeded attempt with its frozen places, in section and question order. */
const seedInventory = Effect.gen(function* () {
  const world = yield* seedTryoutGate;
  const rows = yield* world.run(
    Effect.gen(function* () {
      const database = yield* DatabaseReader;
      return {
        attempt: yield* database.table("tryoutAttempts").get(world.attemptId),
        placements: yield* database
          .table("tryoutAttemptPlacements")
          .index(
            "by_tryoutAttemptId_and_sectionKey_and_questionOrder",
            (query) => query.eq("tryoutAttemptId", world.attemptId)
          )
          .collect(),
      };
    }).pipe(Effect.orDie)
  );
  return { attempt: rows.attempt, placements: rows.placements, world };
});

/** The code an integrity check fails with. */
const codeOf = <A, E extends { readonly code: string }>(
  check: Effect.Effect<A, E>
) =>
  check.pipe(
    Effect.flip,
    Effect.map(({ code }) => code)
  );

describe("tryouts/response/integrity", () => {
  it.effect(
    "refuses frozen sections without questions or with a repeated key or order",
    () =>
      Effect.gen(function* () {
        const { attempt } = yield* seedInventory;
        const [first, second] = attempt.sections;
        assert.ok(first && second);
        expect(yield* validateTryoutSections(attempt.sections)).toBeDefined();
        expect(
          yield* codeOf(
            validateTryoutSections([{ ...first, questionCount: 0 }])
          )
        ).toBe("TRYOUT_PLACEMENT_COUNT_MISMATCH");
        expect(
          yield* codeOf(
            validateTryoutSections([
              first,
              { ...second, sectionKey: first.sectionKey },
            ])
          )
        ).toBe("TRYOUT_SECTION_ATTEMPT_SNAPSHOT_MISMATCH");
        expect(
          yield* codeOf(
            validateTryoutSections([
              first,
              { ...second, sectionOrder: first.sectionOrder },
            ])
          )
        ).toBe("TRYOUT_SECTION_ATTEMPT_SNAPSHOT_MISMATCH");
      })
  );

  it.effect(
    "accepts one place per question of each section and refuses a wrong count, a foreign place, a slot outside its section, and a repeated slot or family",
    () =>
      Effect.gen(function* () {
        const { attempt, placements, world } = yield* seedInventory;
        const [first, second, third] = placements;
        assert.ok(first && second && third);
        const check = (
          changed: typeof placements,
          expectedQuestionCount = attempt.totalQuestions
        ) =>
          validateTryoutResponsePlacementInventory({
            attemptId: attempt._id,
            expectedQuestionCount,
            placements: changed,
            sections: attempt.sections,
          });
        expect(yield* check(placements)).toEqual(placements);
        expect(yield* codeOf(check(placements, 0))).toBe(
          "TRYOUT_PLACEMENT_COUNT_MISMATCH"
        );
        expect(yield* codeOf(check([first, second]))).toBe(
          "TRYOUT_PLACEMENT_COUNT_MISMATCH"
        );
        expect(
          yield* codeOf(
            check([first, second, { ...third, sectionKey: "section-z" }])
          )
        ).toBe("TRYOUT_RESPONSE_LINK_MISMATCH");
        expect(
          yield* codeOf(
            check([
              first,
              second,
              { ...third, tryoutAttemptId: world.missingAttemptId },
            ])
          )
        ).toBe("TRYOUT_RESPONSE_LINK_MISMATCH");
        expect(
          yield* codeOf(check([first, second, { ...third, questionOrder: 2 }]))
        ).toBe("TRYOUT_PLACEMENT_COUNT_MISMATCH");
        expect(
          yield* codeOf(check([first, { ...second, questionOrder: 1 }, third]))
        ).toBe("TRYOUT_PLACEMENT_DUPLICATE");
        expect(
          yield* codeOf(
            check([first, { ...second, family: first.family }, third])
          )
        ).toBe("TRYOUT_PLACEMENT_DUPLICATE");
      })
  );

  it.effect(
    "defers a grade waiting for a grader to the stored decision, and refuses a stored answer of another place",
    () =>
      Effect.gen(function* () {
        const { attempt, placements, world } = yield* seedInventory;
        yield* world.answer("learner", "running", "pending", 1);
        const rows = yield* world.run(
          Effect.gen(function* () {
            const database = yield* DatabaseReader;
            return {
              placement: yield* database
                .table("tryoutAttemptPlacements")
                .get(world.placementId),
              responses: yield* database
                .table("tryoutResponses")
                .index("by_placementId", (query) =>
                  query.eq("placementId", world.placementId)
                )
                .collect(),
            };
          }).pipe(Effect.orDie)
        );
        const [response] = rows.responses;
        assert.ok(response);
        const decided = {
          ...response,
          grade: { category: 1, ceiling: 1, status: "scored" as const },
        };
        const links = [
          {
            placement: rows.placement,
            sectionAttemptId: world.sectionAttemptId,
          },
        ];
        expect(
          yield* indexTryoutResponses({
            attemptId: attempt._id,
            links,
            responses: [decided],
          })
        ).toEqual([decided]);
        const [, other] = placements;
        assert.ok(other);
        expect(
          yield* codeOf(
            indexTryoutResponses({
              attemptId: attempt._id,
              links,
              responses: [{ ...decided, placementId: other._id }],
            })
          )
        ).toBe("TRYOUT_RESPONSE_LINK_MISMATCH");
      })
  );
});
