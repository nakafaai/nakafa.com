import { Ref } from "@confect/core";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { GatewayConfigurationError } from "@repo/backend/confect/gateway/failure";
import { createConvexTestWithBetterAuth } from "@repo/backend/confect/test.helpers";
import { deployment, provider } from "@repo/backend/test/gateway";
import {
  embedWithKnowledge,
  KNOWLEDGE_RELEASE,
  seedKnowledge,
} from "@repo/backend/test/knowledge";
import { Effect } from "effect";

vi.mock("@repo/backend/confect/gateway/live", async () => ({
  GatewayLive: (await import("@repo/backend/test/gateway")).GatewayTest,
}));

const run = Ref.getFunctionReference(refs.internal.contents.sections.build.run);

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  deployment.mockReset();
  provider.embeddingModel.mockReset();
});

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

  it("fails when the deployment cannot reach the gateway", async () => {
    deployment.mockReturnValue(
      Effect.fail(new GatewayConfigurationError({ message: "No gateway." }))
    );
    const t = createConvexTestWithBetterAuth();
    await t.mutation(seedKnowledge);
    await expect(t.action(run, {})).rejects.toThrow();
  });
});
