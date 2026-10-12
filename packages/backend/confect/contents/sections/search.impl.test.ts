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
import { Array as Arr } from "effect";

vi.mock("@repo/backend/confect/gateway/live", async () => ({
  GatewayLive: (await import("@repo/backend/test/gateway")).GatewayTest,
}));

const search = Ref.getFunctionReference(
  refs.internal.contents.sections.search.search
);
const resolve = Ref.getFunctionReference(
  refs.internal.contents.sections.hits.resolve
);

beforeEach(() => vi.useFakeTimers());
afterEach(() => provider.embeddingModel.mockReset());

describe("section search functions", () => {
  it("searches the index of the active release", async () => {
    embedWithKnowledge();
    const t = createConvexTestWithBetterAuth();
    await t.mutation(seedKnowledge);
    await knowledgeBuild(t).build();
    const result = await t.action(search, {
      limit: 1,
      locale: "id",
      query: "Determinante",
    });
    expect(result).toMatchObject({
      hits: [{ anchor: "determinan", appLocale: "id" }],
      kind: "hits",
    });
  });

  it("finishes a search from the candidates of the vector search", async () => {
    embedWithKnowledge();
    const t = createConvexTestWithBetterAuth();
    await t.mutation(seedKnowledge);
    await knowledgeBuild(t).build();
    const [row] = await t.query((ctx) =>
      ctx.db.query("contentSections").take(1)
    );
    const result = await t.query(resolve, {
      ids: Arr.map(row ? [row] : [], ({ _id }) => _id),
      limit: 3,
      locale: "id",
      query: "?!",
    });
    expect(result).toMatchObject({ kind: "hits" });
  });
});
