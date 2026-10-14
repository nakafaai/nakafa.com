import type { GenericId } from "@confect/core";
import { describe, expect, it } from "@effect/vitest";
import type { PromotionDestination } from "@repo/backend/confect/tenancy/promotion";
import {
  cohort,
  entriesOf,
  nf,
  promotionReview,
  promotions,
  scenario,
} from "@repo/backend/test/promotion";
import { tenancyFixture } from "@repo/backend/test/tenancy";
import { Effect } from "effect";

const { create, plan } = promotions;
const { approve, cancel, returnToDraft, submit } = promotionReview;
const denied = (reason: "resource" | "role" | "condition") => ({
  _tag: "AccessDenied",
  code: "ACCESS_DENIED",
  reason,
});

/** The destinations of the scenario's plan: 7A moves on to 8A, and 9A graduates. */
const toEightA: typeof PromotionDestination.Type = {
  kind: "cohort",
  name: "8A",
};
const toGraduate: typeof PromotionDestination.Type = { kind: "graduate" };

/** The plan of the scenario, with the cohorts of its source period. */
const scenarioPlan = (
  seventh: { readonly id: GenericId.GenericId<"tenantCohorts"> },
  ninth: { readonly id: GenericId.GenericId<"tenantCohorts"> }
) => ({
  sources: [
    { cohortId: seventh.id, homeroom: true, to: toEightA },
    { cohortId: ninth.id, homeroom: false, to: toGraduate },
  ],
  targets: [{ grade: 8, name: "8A" }],
});

describe("tenancy/promotions review", () => {
  it.effect(
    "submits a draft once, and refuses a plan that a new cohort of the source period outgrew",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const s = yield* scenario(fixture);
        const made = yield* fixture.as("admin").mutation(create, {
          periodId: s.source.id,
          slug: nf,
          targetPeriodId: s.target.id,
        });
        yield* fixture.as("admin").mutation(plan, {
          promotionId: made.id,
          slug: nf,
          ...scenarioPlan(s.seventh, s.ninth),
        });
        const submitted = yield* fixture
          .as("admin")
          .mutation(submit, { promotionId: made.id, slug: nf });
        const again = yield* fixture
          .as("admin")
          .mutation(submit, { promotionId: made.id, slug: nf })
          .pipe(Effect.flip);
        yield* fixture.as("principal").mutation(returnToDraft, {
          promotionId: made.id,
          reason: "other",
          slug: nf,
        });
        yield* cohort(fixture, s.source.id, "8B", 8);
        const outgrown = yield* fixture
          .as("admin")
          .mutation(submit, { promotionId: made.id, slug: nf })
          .pipe(Effect.flip);
        expect(submitted.state).toBe("submitted");
        expect(again).toMatchObject({ _tag: "PromotionState" });
        expect(outgrown).toMatchObject({
          _tag: "PromotionPlanInvalid",
          reason: "sources",
        });
      })
  );

  it.effect(
    "lets only the principal approve or return a submitted plan, and only the Admin submit it",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const s = yield* scenario(fixture);
        const made = yield* fixture.as("admin").mutation(create, {
          periodId: s.source.id,
          slug: nf,
          targetPeriodId: s.target.id,
        });
        yield* fixture.as("admin").mutation(plan, {
          promotionId: made.id,
          slug: nf,
          ...scenarioPlan(s.seventh, s.ninth),
        });
        const byPrincipalSubmit = yield* fixture
          .as("principal")
          .mutation(submit, { promotionId: made.id, slug: nf })
          .pipe(Effect.flip);
        const onDraft = yield* fixture
          .as("principal")
          .mutation(approve, { promotionId: made.id, slug: nf })
          .pipe(Effect.flip);
        yield* fixture
          .as("admin")
          .mutation(submit, { promotionId: made.id, slug: nf });
        const byAdmin = yield* fixture
          .as("admin")
          .mutation(approve, { promotionId: made.id, slug: nf })
          .pipe(Effect.flip);
        const approved = yield* fixture
          .as("principal")
          .mutation(approve, { promotionId: made.id, slug: nf });
        const onApproved = yield* fixture
          .as("principal")
          .mutation(returnToDraft, {
            promotionId: made.id,
            reason: "other",
            slug: nf,
          })
          .pipe(Effect.flip);
        expect([byPrincipalSubmit, byAdmin]).toMatchObject([
          denied("role"),
          denied("role"),
        ]);
        expect(onDraft).toMatchObject({ _tag: "PromotionState" });
        expect(approved.state).toBe("approved");
        expect(onApproved).toMatchObject({ _tag: "PromotionState" });
      })
  );

  it.effect(
    "returns a submitted plan to draft with its reason code, and cancels only a draft or submitted plan",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const s = yield* scenario(fixture);
        const made = yield* fixture.as("admin").mutation(create, {
          periodId: s.source.id,
          slug: nf,
          targetPeriodId: s.target.id,
        });
        yield* fixture.as("admin").mutation(plan, {
          promotionId: made.id,
          slug: nf,
          ...scenarioPlan(s.seventh, s.ninth),
        });
        yield* fixture
          .as("admin")
          .mutation(submit, { promotionId: made.id, slug: nf });
        const sent = yield* fixture.as("principal").mutation(returnToDraft, {
          promotionId: made.id,
          reason: "students",
          slug: nf,
        });
        const cancelled = yield* fixture
          .as("admin")
          .mutation(cancel, { promotionId: made.id, slug: nf });
        const again = yield* fixture
          .as("admin")
          .mutation(cancel, { promotionId: made.id, slug: nf })
          .pipe(Effect.flip);
        expect(sent).toMatchObject({
          returnReason: "students",
          state: "draft",
        });
        expect(cancelled.state).toBe("cancelled");
        expect(again).toMatchObject({ _tag: "PromotionState" });
        expect(yield* entriesOf(fixture, "promotion.returned")).toMatchObject([
          { change: { reason: "students" } },
        ]);
        expect(yield* entriesOf(fixture, "promotion.cancelled")).toHaveLength(
          1
        );
      })
  );

  it.effect("refuses to cancel an approved plan", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const s = yield* scenario(fixture);
      const made = yield* fixture.as("admin").mutation(create, {
        periodId: s.source.id,
        slug: nf,
        targetPeriodId: s.target.id,
      });
      yield* fixture.as("admin").mutation(plan, {
        promotionId: made.id,
        slug: nf,
        ...scenarioPlan(s.seventh, s.ninth),
      });
      yield* fixture
        .as("admin")
        .mutation(submit, { promotionId: made.id, slug: nf });
      yield* fixture
        .as("principal")
        .mutation(approve, { promotionId: made.id, slug: nf });
      const refusal = yield* fixture
        .as("admin")
        .mutation(cancel, { promotionId: made.id, slug: nf })
        .pipe(Effect.flip);
      expect(refusal).toMatchObject({ _tag: "PromotionState" });
    })
  );
});
