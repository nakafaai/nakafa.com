import { Ref } from "@confect/core";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { GatewayConfigurationError } from "@repo/backend/confect/gateway/failure";
import { createConvexTestWithBetterAuth } from "@repo/backend/confect/test.helpers";
import { makeMaterialProjection } from "@repo/backend/test/content/material";
import { deployment, provider } from "@repo/backend/test/gateway";
import {
  embedWithKnowledge,
  embedWithRefusal,
  knowledgeBuild,
  seedKnowledge,
} from "@repo/backend/test/knowledge";
import { Effect } from "effect";

vi.mock("@repo/backend/confect/gateway/live", async () => ({
  GatewayLive: (await import("@repo/backend/test/gateway")).GatewayTest,
}));

const rank = Ref.getFunctionReference(
  refs.internal.contents.sections.compare.rank
);

const input = {
  locale: "de",
  model: "google/gemini-embedding-001",
  questions: [
    {
      contentKey: makeMaterialProjection("de", 1).contentKey,
      ordinal: 3,
      question: "Wie berechne ich die Determinante einer Matrix?",
    },
  ],
} satisfies typeof rank._args;

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  deployment.mockReset();
  provider.embeddingModel.mockReset();
});

describe("model comparison function", () => {
  it("ranks the questions against the stored sections of a language", async () => {
    embedWithKnowledge();
    const t = createConvexTestWithBetterAuth();
    await t.mutation(seedKnowledge);
    await knowledgeBuild(t).build();
    const result = await t.action(rank, input);
    expect(result).toMatchObject({
      kind: "ranked",
      pool: 9,
      verdicts: [{ section: { heading: "Determinante", rank: 1 } }],
    });
  });

  it("answers with the failure when the gateway refuses the sections of the language", async () => {
    embedWithKnowledge();
    const t = createConvexTestWithBetterAuth();
    await t.mutation(seedKnowledge);
    await knowledgeBuild(t).build();
    embedWithRefusal();
    const result = await t.action(rank, input);
    expect(result).toEqual({
      failure: expect.objectContaining({
        _tag: "GatewayFailure",
        reason: "invalid",
        status: 400,
      }),
      kind: "failed",
    });
  });

  it("answers with the failure when the deployment cannot reach the gateway", async () => {
    deployment.mockReturnValue(
      Effect.fail(new GatewayConfigurationError({ message: "No gateway." }))
    );
    const t = createConvexTestWithBetterAuth();
    const result = await t.action(rank, input);
    expect(result).toEqual({
      failure: { _tag: "GatewayConfigurationError", message: "No gateway." },
      kind: "failed",
    });
  });
});
