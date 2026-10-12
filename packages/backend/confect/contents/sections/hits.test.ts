import { RegisteredConvexFunction } from "@confect/server";
import {
  afterEach,
  assert,
  beforeEach,
  describe,
  expect,
  it,
} from "@effect/vitest";
import confectSchema from "@repo/backend/confect/_generated/schema";
import { resolveHits } from "@repo/backend/confect/contents/sections/hits";
import { createConvexTestWithBetterAuth } from "@repo/backend/confect/test.helpers";
import { provider } from "@repo/backend/test/gateway";
import {
  embedWithKnowledge,
  knowledgeBuild,
  seedKnowledge,
} from "@repo/backend/test/knowledge";
import { Array as Arr, Effect, Option } from "effect";

beforeEach(() => vi.useFakeTimers());
afterEach(() => provider.embeddingModel.mockReset());

type Input = Parameters<typeof resolveHits>[0];

/** A deployment whose active release is indexed. */
async function indexed() {
  embedWithKnowledge();
  const t = createConvexTestWithBetterAuth();
  await t.mutation(seedKnowledge);
  await knowledgeBuild(t).build();
  const rows = () =>
    t.query((ctx) => ctx.db.query("contentSections").collect());
  const idOf = async (appLocale: string, anchor: string, contentKey = "") => {
    const found = Arr.findFirst(
      await rows(),
      (row) =>
        row.appLocale === appLocale &&
        row.anchor === anchor &&
        row.contentKey.endsWith(contentKey)
    );
    return Option.getOrThrow(found)._id;
  };
  const resolve = (input: Input) =>
    t.mutation((ctx) =>
      Effect.runPromise(
        resolveHits(input).pipe(
          Effect.provide(
            RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
          )
        )
      )
    );
  const places = async (input: Input) => {
    const result = await resolve(input);
    if (result.kind !== "hits") {
      throw new Error("Expected the index to hold sections.");
    }
    return Arr.map(
      result.hits,
      ({ anchor, appLocale }) => `${appLocale}:${anchor}`
    );
  };
  /** Resolves the hits and gives how many there are and how many documents the transaction read. */
  const measure = (input: Input) =>
    t.mutation(async (ctx) => {
      const result = await Effect.runPromise(
        resolveHits(input).pipe(
          Effect.provide(
            RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
          )
        )
      );
      const metrics = await ctx.meta.getTransactionMetrics();
      return {
        documentsRead: metrics.documentsRead.used,
        hits: result.kind === "hits" ? result.hits.length : 0,
      };
    });
  return { idOf, measure, places, resolve, t };
}

describe("section hits", () => {
  it("adds the sections found by words to those found by meaning and ranks them together", async () => {
    const { idOf, places } = await indexed();
    const determinant = await idOf("id", "determinan", "section-1");
    expect(
      await places({
        ids: [determinant],
        limit: 5,
        locale: "id",
        query: "kuadrat",
      })
    ).toEqual(["id:determinan", "id:top", "id:rumus-kuadrat"]);
  });

  it("gives a section found in another language in the language of the learner", async () => {
    const { idOf, places } = await indexed();
    const unrelated = await idOf("id", "top", "section-2");
    expect(
      await places({
        ids: [unrelated],
        limit: 3,
        locale: "id",
        query: "Determinante",
      })
    ).toEqual(["id:top", "id:determinan"]);
  });

  it("keeps a section in its own language when the learner's language lacks it", async () => {
    const { idOf, places, t } = await indexed();
    const unrelated = await idOf("id", "top", "section-2");
    const counterpart = await idOf("id", "determinan", "section-1");
    await t.mutation((ctx) => ctx.db.delete("contentSections", counterpart));
    expect(
      await places({
        ids: [unrelated],
        limit: 3,
        locale: "id",
        query: "Determinante",
      })
    ).toEqual(["id:top", "de:determinante"]);
  });

  it("keeps a section in its own language when the learner's language splits the document differently", async () => {
    const { idOf, places, t } = await indexed();
    const unrelated = await idOf("id", "top", "section-2");
    const counterpart = await idOf("id", "determinan", "section-1");
    await t.mutation((ctx) =>
      ctx.db.patch("contentSections", counterpart, { count: 99 })
    );
    expect(
      await places({
        ids: [unrelated],
        limit: 3,
        locale: "id",
        query: "Determinante",
      })
    ).toEqual(["id:top", "de:determinante"]);
  });

  it("searches the words of one kind of content when asked", async () => {
    const { idOf, places } = await indexed();
    const unrelated = await idOf("id", "top", "section-2");
    expect(
      await places({
        ids: [unrelated],
        limit: 5,
        locale: "id",
        query: "politik",
        section: "material",
      })
    ).toEqual(["id:top"]);
    expect(
      await places({
        ids: [unrelated],
        limit: 5,
        locale: "id",
        query: "politik",
      })
    ).toContain("id:gambaran");
  });

  it("keeps only the best sections, up to the limit", async () => {
    const { idOf, places } = await indexed();
    const ids = [
      await idOf("id", "top", "section-1"),
      await idOf("id", "top", "section-2"),
    ];
    expect(await places({ ids, limit: 1, locale: "id", query: "?!" })).toEqual([
      "id:top",
    ]);
    expect(
      await places({ ids, limit: 5, locale: "id", query: "?!" })
    ).toHaveLength(2);
  });

  it("leaves out the sections of a document that is no longer published", async () => {
    const { idOf, places, t } = await indexed();
    const ids = [
      await idOf("id", "diskriminan", "section-2"),
      await idOf("id", "determinan", "section-1"),
    ];
    await t.mutation(async (ctx) => {
      for (const row of await ctx.db.query("materialCatalog").collect()) {
        if (row.appLocale === "id" && row.contentKey.endsWith("section-2")) {
          await ctx.db.delete("materialCatalog", row._id);
        }
      }
    });
    expect(await places({ ids, limit: 5, locale: "id", query: "?!" })).toEqual([
      "id:determinan",
    ]);
  });

  it("reads the reference of a document once, however many of its sections rank", async () => {
    const { idOf, measure } = await indexed();
    const determinant = await idOf("id", "determinan", "section-1");
    const square = await idOf("id", "matriks-persegi", "section-1");
    const input = { limit: 5, locale: "id", query: "?!" } as const;
    const one = await measure({ ...input, ids: [determinant] });
    const two = await measure({ ...input, ids: [determinant, square] });
    expect(two.hits).toBe(2);
    // The second section costs its own row and nothing more.
    expect(two.documentsRead - one.documentsRead).toBe(1);
  });

  it("reads its own row and the five documents of the reference for each other document that a section belongs to", async () => {
    const { idOf, measure } = await indexed();
    const determinant = await idOf("id", "determinan", "section-1");
    const discriminant = await idOf("id", "diskriminan", "section-2");
    const input = { limit: 5, locale: "id", query: "?!" } as const;
    const one = await measure({ ...input, ids: [determinant] });
    const two = await measure({ ...input, ids: [determinant, discriminant] });
    expect(two.hits).toBe(2);
    expect(two.documentsRead - one.documentsRead).toBe(6);
  });

  it("reads a row once when both the meaning and the words found it", async () => {
    const { idOf, measure } = await indexed();
    const determinant = await idOf("id", "determinan", "section-1");
    const input = { ids: [determinant], limit: 5, locale: "id" } as const;
    const byMeaning = await measure({ ...input, query: "?!" });
    // The words match the start of a word, so they find the same section in
    // English and German too, two rows more, and the Indonesian row that the
    // meaning found, which is not read a second time.
    const both = await measure({ ...input, query: "determinan" });
    expect(both).toEqual({
      documentsRead: byMeaning.documentsRead + 2,
      hits: 1,
    });
  });

  it("reads the two records of the state of the index, one section and the reference of its document for one hit", async () => {
    const { idOf, measure } = await indexed();
    const determinant = await idOf("id", "determinan", "section-1");
    // The active release and the last build, the row of the section, and the
    // five documents of the reference.
    expect(
      await measure({
        ids: [determinant],
        limit: 5,
        locale: "id",
        query: "?!",
      })
    ).toEqual({ documentsRead: 8, hits: 1 });
  });

  it("says the index is empty when another release became active after the vector search found its sections", async () => {
    const { idOf, resolve, t } = await indexed();
    const input = {
      ids: [await idOf("id", "determinan", "section-1")],
      limit: 5,
      locale: "id",
      query: "determinan",
    } as const;
    expect((await resolve(input)).kind).toBe("hits");
    // An activation commits between the readiness answer and this query: the
    // sections found are those of a release that is gone.
    await t.mutation(async (ctx) => {
      const state = await ctx.db.query("contentState").unique();
      assert.ok(state, "Expected one active content state.");
      await ctx.db.patch("contentState", state._id, {
        activeReleaseId: "release-2",
      });
    });
    expect(await resolve(input)).toEqual({ kind: "empty" });
  });

  it("returns a place once when the words find it in several languages", async () => {
    const { idOf, places } = await indexed();
    const unrelated = await idOf("id", "top", "section-2");
    // The Indonesian and the German article both hold the word.
    expect(
      await places({
        ids: [unrelated],
        limit: 5,
        locale: "id",
        query: "politik",
      })
    ).toEqual(["id:top", "id:gambaran"]);
  });

  it("says the index is empty when the vector search found no stored section", async () => {
    const { idOf, resolve, t } = await indexed();
    expect(
      await resolve({ ids: [], limit: 5, locale: "id", query: "determinan" })
    ).toEqual({ kind: "empty" });
    const gone = await idOf("id", "top", "section-2");
    await t.mutation((ctx) => ctx.db.delete("contentSections", gone));
    expect(
      await resolve({
        ids: [gone],
        limit: 5,
        locale: "id",
        query: "determinan",
      })
    ).toEqual({ kind: "empty" });
  });
});
