import { Ref } from "@confect/core";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { createConvexTestWithBetterAuth } from "@repo/backend/confect/test.helpers";
import { provider } from "@repo/backend/test/gateway";
import {
  embedWithKnowledge,
  knowledgeBuild,
  seedKnowledge,
} from "@repo/backend/test/knowledge";

const ready = Ref.getFunctionReference(
  refs.internal.contents.sections.state.ready
);

beforeEach(() => vi.useFakeTimers());
afterEach(() => provider.embeddingModel.mockReset());

describe("section index state function", () => {
  it("says the index may answer once the build of the active release has finished, and not before", async () => {
    embedWithKnowledge();
    const t = createConvexTestWithBetterAuth();
    await t.mutation(seedKnowledge);
    expect(await t.query(ready, {})).toBe(false);
    await knowledgeBuild(t).build();
    expect(await t.query(ready, {})).toBe(true);
  });
});
