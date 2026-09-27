import { Ref } from "@confect/core";
import { expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { createConvexTestWithBetterAuth } from "@repo/backend/confect/test.helpers";
import { api } from "@repo/backend/convex/_generated/api";
import { seedTryoutContentAccessState } from "@repo/backend/test/tryout/runtime";
import { TRYOUT_TEST_NOW } from "@repo/backend/test/tryouts";
import { Option } from "effect";

it.each([
  {
    scenario: "selection",
    tag: "TryoutResponseSelectionError",
    code: "TRYOUT_RESPONSE_SELECTION_INVALID",
  },
  {
    scenario: "integrity",
    tag: "TryoutResponseIntegrityError",
    code: "TRYOUT_SECTION_ATTEMPT_SNAPSHOT_MISMATCH",
  },
  {
    scenario: "ownership",
    tag: "TryoutAttemptStateError",
    code: "TRYOUT_ATTEMPT_NOT_FOUND",
  },
  {
    scenario: "terminal",
    tag: "TryoutAttemptStateError",
    code: "TRYOUT_ATTEMPT_NOT_ACTIVE",
  },
  {
    scenario: "auth",
    tag: "SessionRequired",
    code: "UNAUTHENTICATED",
  },
])(
  "restores the $scenario failure tag from the registered response payload",
  async ({ scenario, tag, code }) => {
    vi.setSystemTime(new Date(TRYOUT_TEST_NOW));
    const t = createConvexTestWithBetterAuth();
    const fixture = await t.mutation((ctx) =>
      seedTryoutContentAccessState(ctx, {
        suffix: scenario,
        attemptStatus: scenario === "terminal" ? "completed" : "in-progress",
        sectionStatus: "in-progress",
      })
    );
    if (scenario === "ownership") {
      await t.mutation((ctx) =>
        ctx.db.delete("tryoutAttempts", fixture.attemptId)
      );
    }
    if (scenario === "integrity") {
      await t.mutation((ctx) =>
        ctx.db.patch("tryoutSectionAttempts", fixture.sectionAttemptId, {
          sectionIdentity: "another-section",
        })
      );
    }
    const client =
      scenario === "auth"
        ? t
        : t.withIdentity({
            sessionId: fixture.identity.sessionId,
            subject: fixture.identity.authUserId,
          });
    const rejected = await client
      .mutation(api.tryouts.mutations.responses.save, {
        placementId: fixture.placementId,
        selection: {
          kind: "single-choice",
          optionKey: "outside-the-frozen-options",
        },
      })
      .catch((error: unknown) => error);
    expect(rejected).toMatchObject({
      data: {
        code,
      },
    });
    if (!Ref.isConvexError(rejected)) {
      throw rejected;
    }
    const decoded = Ref.decodeErrorOption(
      refs.public.tryouts.mutations.responses.save,
      rejected.data
    );
    expect(
      Option.map(decoded, (error) => ({
        _tag: error._tag,
        code: error.code,
      }))
    ).toEqual(
      Option.some({
        _tag: tag,
        code,
      })
    );
    expect(
      await t.query((ctx) => ctx.db.query("tryoutResponses").collect())
    ).toEqual([]);
  }
);
