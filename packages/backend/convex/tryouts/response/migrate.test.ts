import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "@effect/vitest";
import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { TRYOUT_ATTEMPT_PLACEMENT_DOCUMENT_LIMIT } from "@repo/backend/convex/contentRelease/tryout/limits";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import type { TryoutResponseSpec } from "@repo/backend/convex/tryouts/response/model";
import { seedTryoutContentAccessState } from "@repo/backend/test/tryout/runtime";
import { TRYOUT_TEST_NOW } from "@repo/backend/test/tryouts";
import { type DefaultFunctionArgs, makeFunctionReference } from "convex/server";

const start = makeFunctionReference<"mutation", Record<string, never>, null>(
  "tryouts/response/migrate:start"
);
interface MigrationPageArgs extends DefaultFunctionArgs {
  cursor: string | null;
  phase: "placements" | "responses";
}
const page = makeFunctionReference<"mutation", MigrationPageArgs, null>(
  "tryouts/response/migrate:page"
);

type ConvexTest = ReturnType<typeof createConvexTestWithBetterAuth>;

describe("tryouts/response/migrate", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("migrates multiple pages without deleting predecessor fields", async () => {
    const t = createConvexTestWithBetterAuth();
    const fixture = await seedMigrationFixture(t, 51);

    await t.mutation(start, {});
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const migrated = await readMigrationState(t);
    expect(migrated.placements).toHaveLength(52);
    expect(
      migrated.placements.every(
        ({ choiceSnapshots, responseSpec }) =>
          choiceSnapshots !== undefined && responseSpec !== undefined
      )
    ).toBe(true);
    expect(migrated.responses).toHaveLength(2);
    expect(migrated.responses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          isComplete: true,
          isCorrect: fixture.selected.isCorrect,
          selectedOptionId: fixture.selected.optionKey,
          selection: {
            kind: "single-choice",
            optionKey: fixture.selected.optionKey,
          },
        }),
        expect.objectContaining({
          isComplete: true,
          selection: {
            kind: "single-choice",
            optionKey: fixture.selected.optionKey,
          },
        }),
      ])
    );
    expect(
      migrated.jobs
        .filter(({ name }) => name === "tryouts/response/migrate:page")
        .every(({ state }) => state.kind === "success")
    ).toBe(true);

    await t.mutation(start, {});
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const repeated = await readMigrationState(t);
    expect(repeated.placements).toEqual(migrated.placements);
    expect(repeated.responses).toEqual(migrated.responses);
  });

  it("rejects a placement whose predecessor and replacement differ", async () => {
    const t = createConvexTestWithBetterAuth();
    await seedMigrationFixture(t, 1);
    await t.mutation(async (ctx) => {
      const placements = await ctx.db
        .query("tryoutAttemptPlacements")
        .collect();
      const placement = placements.find(
        ({ choiceSnapshots, responseSpec }) =>
          choiceSnapshots !== undefined &&
          responseSpec?.kind === "single-choice"
      );
      if (placement?.responseSpec?.kind !== "single-choice") {
        throw new Error("Expected one dual-written placement fixture.");
      }
      const [first, ...remaining] = placement.responseSpec.options;
      if (!first) {
        throw new Error("Expected one response option.");
      }
      await ctx.db.patch(placement._id, {
        responseSpec: {
          ...placement.responseSpec,
          options: [
            { ...first, label: `${first.label} changed` },
            ...remaining,
          ],
        },
      });
    });

    await expect(
      t.mutation(page, {
        cursor: null,
        phase: "placements",
      })
    ).rejects.toMatchObject({
      data: { code: "TRYOUT_RESPONSE_MIGRATION_INVALID" },
    });
  });

  it("rejects a historical placement that hydration would oversize", async () => {
    const t = createConvexTestWithBetterAuth();
    await seedMigrationFixture(t, 1);
    const placementId = await t.mutation(async (ctx) => {
      const placements = await ctx.db
        .query("tryoutAttemptPlacements")
        .collect();
      const placement = placements.find(
        ({ choiceSnapshots, responseSpec }) =>
          choiceSnapshots !== undefined && responseSpec === undefined
      );
      const [firstChoice, ...remainingChoices] =
        placement?.choiceSnapshots ?? [];
      if (!(placement && firstChoice)) {
        throw new Error("Expected one historical placement fixture.");
      }
      await ctx.db.patch(placement._id, {
        choiceSnapshots: [
          {
            ...firstChoice,
            label: "x".repeat(TRYOUT_ATTEMPT_PLACEMENT_DOCUMENT_LIMIT),
          },
          ...remainingChoices,
        ],
      });
      return placement._id;
    });

    await expect(
      t.mutation(page, {
        cursor: null,
        phase: "placements",
      })
    ).rejects.toMatchObject({
      data: { code: "TRYOUT_RESPONSE_MIGRATION_INVALID" },
    });
    const unchanged = await t.run((ctx) => ctx.db.get(placementId));
    expect(unchanged?.responseSpec).toBeUndefined();
  });

  it("rejects a response whose predecessor and replacement differ", async () => {
    const t = createConvexTestWithBetterAuth();
    await seedMigrationFixture(t, 1);
    await t.mutation(start, {});
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    await t.mutation(async (ctx) => {
      const responses = await ctx.db.query("tryoutResponses").collect();
      const response = responses.find(
        ({ selectedOptionId, selection }) =>
          selectedOptionId !== undefined && selection?.kind === "single-choice"
      );
      if (!response) {
        throw new Error("Expected one dual-written response fixture.");
      }
      await ctx.db.patch(response._id, {
        selection: { kind: "single-choice", optionKey: "option-2" },
      });
    });

    await expect(
      t.mutation(page, {
        cursor: null,
        phase: "responses",
      })
    ).rejects.toMatchObject({
      data: { code: "TRYOUT_RESPONSE_MIGRATION_INVALID" },
    });
  });

  it("rejects a historical score that differs from the frozen answer", async () => {
    const t = createConvexTestWithBetterAuth();
    await seedInvalidResponse(t, "score", ({ selected }) => ({
      isCorrect: !selected.isCorrect,
      selectedOptionId: selected.optionKey,
    }));

    await expect(
      t.mutation(page, {
        cursor: null,
        phase: "responses",
      })
    ).rejects.toMatchObject({
      data: { code: "TRYOUT_RESPONSE_MIGRATION_INVALID" },
    });
  });

  it("rejects a selection outside its frozen response", async () => {
    const t = createConvexTestWithBetterAuth();
    await seedInvalidResponse(t, "selection", () => ({
      isCorrect: false,
      selectedOptionId: "missing-option",
    }));

    await expect(
      t.mutation(page, {
        cursor: null,
        phase: "responses",
      })
    ).rejects.toMatchObject({
      data: { code: "TRYOUT_RESPONSE_MIGRATION_INVALID" },
    });
  });

  it("rejects a response whose placement no longer exists", async () => {
    const t = createConvexTestWithBetterAuth();
    await seedInvalidResponse(t, "placement", ({ selected }) => ({
      deletePlacement: true,
      isCorrect: selected.isCorrect,
      selectedOptionId: selected.optionKey,
    }));

    await expect(
      t.mutation(page, {
        cursor: null,
        phase: "responses",
      })
    ).rejects.toMatchObject({
      data: { code: "TRYOUT_RESPONSE_MIGRATION_INVALID" },
    });
  });

  it("rejects a response linked to another attempt", async () => {
    const t = createConvexTestWithBetterAuth();
    await seedMigrationFixture(t, 1);
    await t.mutation(async (ctx) => {
      const response = await ctx.db.query("tryoutResponses").first();
      if (!response) {
        throw new Error("Expected one response to cross-link.");
      }
      const attempt = await ctx.db.get(response.tryoutAttemptId);
      if (!attempt) {
        throw new Error("Expected the response attempt fixture.");
      }
      const { _creationTime, _id, ...attemptFields } = attempt;
      const otherAttemptId = await ctx.db.insert("tryoutAttempts", {
        ...attemptFields,
        attemptNumber: attempt.attemptNumber + 1,
      });
      await ctx.db.patch(response._id, { tryoutAttemptId: otherAttemptId });
    });

    await expect(
      t.mutation(page, {
        cursor: null,
        phase: "responses",
      })
    ).rejects.toMatchObject({
      data: { code: "TRYOUT_RESPONSE_MIGRATION_INVALID" },
    });
  });

  it("rejects a response linked to another section", async () => {
    const t = createConvexTestWithBetterAuth();
    await seedMigrationFixture(t, 1);
    await t.mutation(async (ctx) => {
      const response = await ctx.db.query("tryoutResponses").first();
      if (!response) {
        throw new Error("Expected one response to cross-link.");
      }
      const section = await ctx.db.get(response.tryoutSectionAttemptId);
      if (!section) {
        throw new Error("Expected the response section fixture.");
      }
      const { _creationTime, _id, ...sectionFields } = section;
      const otherSectionAttemptId = await ctx.db.insert(
        "tryoutSectionAttempts",
        {
          ...sectionFields,
          sectionIdentity: `${section.sectionIdentity}:other`,
          sectionKey: "other-section",
        }
      );
      await ctx.db.patch(response._id, {
        tryoutSectionAttemptId: otherSectionAttemptId,
      });
    });

    await expect(
      t.mutation(page, {
        cursor: null,
        phase: "responses",
      })
    ).rejects.toMatchObject({
      data: { code: "TRYOUT_RESPONSE_MIGRATION_INVALID" },
    });
  });

  it("rejects a response with no supported learner selection", async () => {
    const t = createConvexTestWithBetterAuth();
    await seedInvalidResponse(t, "empty", ({ selected }) => ({
      isCorrect: selected.isCorrect,
    }));

    await expect(
      t.mutation(page, {
        cursor: null,
        phase: "responses",
      })
    ).rejects.toMatchObject({
      data: { code: "TRYOUT_RESPONSE_MIGRATION_INVALID" },
    });
  });
});

/** Seeds enough legacy placements to cross the production page boundary. */
async function seedMigrationFixture(t: ConvexTest, additional: number) {
  return await t.mutation(async (ctx) => {
    const seeded = await seedTryoutContentAccessState(ctx, {
      attemptStatus: "in-progress",
      sectionStatus: "in-progress",
      suffix: "response-migration",
    });
    const placement = await ctx.db.get(seeded.placementId);
    if (!placement?.choiceSnapshots) {
      throw new Error("Expected one legacy placement fixture.");
    }
    const selected = requireChoice(placement.choiceSnapshots);
    await insertLegacyResponse(ctx, seeded, {
      isCorrect: selected.isCorrect,
      selectedOptionId: selected.optionKey,
    });

    let canonicalPlacementId: Id<"tryoutAttemptPlacements"> | null = null;
    for (let index = 0; index < additional; index += 1) {
      canonicalPlacementId = await ctx.db.insert("tryoutAttemptPlacements", {
        answerArtifactHash: placement.answerArtifactHash,
        answerContentKey: placement.answerContentKey,
        choiceSnapshots: placement.choiceSnapshots,
        contentHash: placement.contentHash,
        placementIdentity: `${placement.placementIdentity}:migration-${index}`,
        placementRowHash: placement.placementRowHash,
        questionArtifactHash: placement.questionArtifactHash,
        questionContentKey: placement.questionContentKey,
        questionOrder: placement.questionOrder + index + 1,
        rendererDomain: placement.rendererDomain,
        sectionIdentity: placement.sectionIdentity,
        sectionKey: placement.sectionKey,
        sourcePath: placement.sourcePath,
        sourceRevision: placement.sourceRevision,
        tryoutAttemptId: placement.tryoutAttemptId,
      });
    }
    if (!canonicalPlacementId) {
      throw new Error("Expected one copied placement fixture.");
    }
    const responseSpec = singleChoice(placement.choiceSnapshots);
    await ctx.db.patch(canonicalPlacementId, { responseSpec });
    await ctx.db.insert("tryoutResponses", {
      answeredAt: TRYOUT_TEST_NOW,
      isComplete: true,
      isCorrect: selected.isCorrect,
      placementId: canonicalPlacementId,
      selection: {
        kind: "single-choice",
        optionKey: selected.optionKey,
      },
      timeSpent: 1,
      tryoutAttemptId: seeded.attemptId,
      tryoutSectionAttemptId: seeded.sectionAttemptId,
      updatedAt: TRYOUT_TEST_NOW,
    });
    return { selected };
  });
}

/** Seeds one canonical placement and a deliberately invalid legacy response. */
async function seedInvalidResponse(
  t: ConvexTest,
  suffix: string,
  makeResponse: (input: { selected: ReturnType<typeof requireChoice> }) => {
    deletePlacement?: boolean;
    isCorrect: boolean;
    selectedOptionId?: string;
  }
) {
  await t.mutation(async (ctx) => {
    const seeded = await seedTryoutContentAccessState(ctx, {
      attemptStatus: "in-progress",
      sectionStatus: "in-progress",
      suffix: `response-migration-${suffix}`,
    });
    const placement = await ctx.db.get(seeded.placementId);
    if (!placement?.choiceSnapshots) {
      throw new Error("Expected one legacy placement fixture.");
    }
    const selected = requireChoice(placement.choiceSnapshots);
    await ctx.db.patch(placement._id, {
      responseSpec: singleChoice(placement.choiceSnapshots),
    });
    const response = makeResponse({ selected });
    await insertLegacyResponse(ctx, seeded, response);
    if (response.deletePlacement) {
      await ctx.db.delete(placement._id);
    }
  });
}

/** Stores one predecessor response row without canonical selection fields. */
function insertLegacyResponse(
  ctx: MutationCtx,
  seeded: Awaited<ReturnType<typeof seedTryoutContentAccessState>>,
  response: {
    readonly isCorrect: boolean;
    readonly selectedOptionId?: string;
  }
) {
  return ctx.db.insert("tryoutResponses", {
    answeredAt: TRYOUT_TEST_NOW,
    isCorrect: response.isCorrect,
    placementId: seeded.placementId,
    selectedOptionId: response.selectedOptionId,
    timeSpent: 1,
    tryoutAttemptId: seeded.attemptId,
    tryoutSectionAttemptId: seeded.sectionAttemptId,
    updatedAt: TRYOUT_TEST_NOW,
  });
}

/** Returns one deterministic option from the frozen legacy response. */
function requireChoice(
  choices: NonNullable<Doc<"tryoutAttemptPlacements">["choiceSnapshots"]>
) {
  const selected = choices.at(0);
  if (!selected) {
    throw new Error("Expected one frozen response option.");
  }
  return selected;
}

/** Converts fixture choices to the exact canonical single-choice contract. */
function singleChoice(
  choices: Parameters<typeof requireChoice>[0]
): TryoutResponseSpec {
  return { kind: "single-choice", options: [...choices] };
}

/** Reads persisted rows and migration jobs for end-to-end assertions. */
async function readMigrationState(t: ConvexTest) {
  return await t.query(async (ctx) => ({
    jobs: await ctx.db.system.query("_scheduled_functions").collect(),
    placements: await ctx.db.query("tryoutAttemptPlacements").collect(),
    responses: await ctx.db.query("tryoutResponses").collect(),
  }));
}
