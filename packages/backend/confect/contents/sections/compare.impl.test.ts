import { Ref } from "@confect/core";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { createConvexTestWithBetterAuth } from "@repo/backend/confect/test.helpers";
import { makeMaterialProjection } from "@repo/backend/test/content/material";
import { provider } from "@repo/backend/test/gateway";
import {
  embedWithKnowledge,
  knowledgeBuild,
  seedKnowledge,
} from "@repo/backend/test/knowledge";

vi.mock("@repo/backend/confect/gateway/live", async () => ({
  GatewayLive: (await import("@repo/backend/test/gateway")).GatewayTest,
}));

const rank = Ref.getFunctionReference(
  refs.internal.contents.sections.compare.rank
);

beforeEach(() => vi.useFakeTimers());
afterEach(() => provider.embeddingModel.mockReset());

describe("model comparison function", () => {
  it("ranks the questions against the stored sections of a language", async () => {
    embedWithKnowledge();
    const t = createConvexTestWithBetterAuth();
    await t.mutation(seedKnowledge);
    await knowledgeBuild(t).build();
    const result = await t.action(rank, {
      locale: "de",
      model: "google/gemini-embedding-001",
      questions: [
        {
          contentKey: makeMaterialProjection("de", 1).contentKey,
          ordinal: 3,
          question: "Wie berechne ich die Determinante einer Matrix?",
        },
      ],
    });
    expect(result).toMatchObject({
      kind: "ranked",
      pool: 9,
      verdicts: [{ section: { heading: "Determinante", rank: 1 } }],
    });
  });
});
