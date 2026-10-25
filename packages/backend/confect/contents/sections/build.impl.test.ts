import { Ref } from "@confect/core";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import type {
  Position,
  stepInputValidator,
} from "@repo/backend/confect/contents/sections/build.spec";
import { GatewayConfigurationError } from "@repo/backend/confect/gateway/failure";
import { createConvexTestWithBetterAuth } from "@repo/backend/confect/test.helpers";
import { deployment, provider } from "@repo/backend/test/gateway";
import {
  editKnowledgeLesson,
  embedWithKnowledge,
  embedWithKnowledgeRefusing,
  KNOWLEDGE_RELEASE,
  seedKnowledge,
} from "@repo/backend/test/knowledge";
import { Array as Arr, Effect, Option } from "effect";

vi.mock("@repo/backend/confect/gateway/live", async () => ({
  GatewayLive: (await import("@repo/backend/test/gateway")).GatewayTest,
}));

const run = Ref.getFunctionReference(refs.internal.contents.sections.build.run);

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  deployment.mockReset();
  provider.embeddingModel.mockReset();
});

/** Runs a build from one step to the last, one step at a time as the scheduler does, and gives the position of each. */
async function positionsFrom(
  t: ReturnType<typeof createConvexTestWithBetterAuth>,
  input: typeof stepInputValidator.Type
): Promise<readonly Position[]> {
  const step = await t.action(run, input);
  if (step.next === null) {
    return [step.position];
  }
  return [step.position, ...(await positionsFrom(t, step.next))];
}

describe("section build function", () => {
  it("runs a step of the build for the active release", async () => {
    embedWithKnowledge();
    const t = createConvexTestWithBetterAuth();
    await t.mutation(seedKnowledge);
    const result = await t.action(run, {});
    expect(result).toMatchObject({
      embedded: expect.any(Number),
      next: { releaseId: KNOWLEDGE_RELEASE.releaseId },
      position: { cursor: null, phase: "lessons" },
      stale: false,
    });
  });

  it("resumes from the logged position of a step with the count of the sections it left out before that position", async () => {
    embedWithKnowledgeRefusing("Terlarang");
    const t = createConvexTestWithBetterAuth();
    await t.mutation(async (ctx) => {
      await seedKnowledge(ctx);
      await editKnowledgeLesson(
        ctx,
        1,
        "id",
        "Terlarang menyusun bilangan.\n\n## Bentuk Matriks\n\nTerlarang.\n\n## Determinan\n\nTerlarang juga."
      );
    });
    const positions = await positionsFrom(t, {});
    const quran = Option.getOrThrow(
      Arr.findFirst(positions, ({ phase }) => phase === "quran")
    );
    expect(quran).toMatchObject({ missing: 3 });
    // An operator resumes from the position that the log names, and nothing
    // else, so the count of the lesson left out before it travels with it.
    await positionsFrom(t, { position: quran });
    expect(
      await t.query((ctx) => ctx.db.query("contentSectionState").collect())
    ).toMatchObject([{ missing: 3, releaseId: KNOWLEDGE_RELEASE.releaseId }]);
  });

  it("fails when the deployment cannot reach the gateway", async () => {
    deployment.mockReturnValue(
      Effect.fail(new GatewayConfigurationError({ message: "No gateway." }))
    );
    const t = createConvexTestWithBetterAuth();
    await t.mutation(seedKnowledge);
    await expect(t.action(run, {})).rejects.toThrow();
  });
});
