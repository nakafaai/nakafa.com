import { RegisteredConvexFunction } from "@confect/server";
import { assert, describe, expect, it } from "@effect/vitest";
import confectSchema from "@repo/backend/confect/_generated/schema";
import type {
  SectionDraft,
  Source,
  storedSectionValidator,
} from "@repo/backend/confect/contents/sections/schema";
import {
  knownSections,
  storeDocument,
} from "@repo/backend/confect/contents/sections/store";
import { embeddingDimensions } from "@repo/backend/confect/gateway/model";
import { createConvexTestWithBetterAuth } from "@repo/backend/confect/test.helpers";
import { KNOWLEDGE_RELEASE, seedKnowledge } from "@repo/backend/test/knowledge";
import { Array as Arr, Effect } from "effect";

const MODEL = "google/gemini-embedding-2";
const OTHER_MODEL = "qwen/qwen3-embedding-8b";
const ACTIVE = KNOWLEDGE_RELEASE.releaseId;
const vector = Arr.makeBy(embeddingDimensions, (index) =>
  index === 0 ? 1 : 0
);
const otherVector = Arr.makeBy(embeddingDimensions, (index) =>
  index === 1 ? 1 : 0
);
const newVector = Arr.makeBy(embeddingDimensions, (index) =>
  index === 2 ? 1 : 0
);

const matrix: Source = {
  appLocale: "id",
  contentKey: "material/lesson/matematika/matriks",
  section: "material",
  version: "first",
};

/** A section in the Indonesian lesson of the fixture, told apart by its place. */
function draft(ordinal: number, hash = "sha256:first"): SectionDraft {
  return {
    anchor: `bagian-${ordinal}`,
    appLocale: "id",
    contentKey: matrix.contentKey,
    count: 4,
    excerpt: `Bagian ${ordinal}.`,
    hash,
    headingPath: [`Bagian ${ordinal}`],
    ordinal,
    publicPath: "materi/matematika/matriks",
    section: "material",
    text: `Matriks\nBagian ${ordinal}`,
  };
}

function toStore(
  section: SectionDraft,
  embedding?: readonly number[]
): typeof storedSectionValidator.Type {
  return embedding === undefined ? section : { ...section, embedding };
}

/** A deployment whose active release is the one of the knowledge fixture. */
async function setup() {
  const t = createConvexTestWithBetterAuth();
  await t.mutation(seedKnowledge);
  const run = (
    releaseId: string,
    sections: readonly (typeof storedSectionValidator.Type)[],
    options: { model?: string; source?: Source } = {}
  ) =>
    t.mutation(async (ctx) => {
      const result = await Effect.runPromise(
        storeDocument({
          model: options.model ?? MODEL,
          releaseId,
          sections,
          source: options.source ?? matrix,
        }).pipe(
          Effect.provide(
            RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
          )
        )
      );
      return { metrics: await ctx.meta.getTransactionMetrics(), result };
    });
  const store = async (
    ...args: Parameters<typeof run>
  ): Promise<Awaited<ReturnType<typeof run>>["result"]> =>
    (await run(...args)).result;
  const rows = () =>
    t.query((ctx) => ctx.db.query("contentSections").collect());
  const sources = () =>
    t.query((ctx) => ctx.db.query("contentSectionSources").collect());
  /** Makes another release the active one, as an activation does. */
  const activate = (releaseId: string) =>
    t.mutation(async (ctx) => {
      const state = await ctx.db.query("contentState").unique();
      assert.ok(state, "Expected one active content state.");
      await ctx.db.patch("contentState", state._id, {
        activeReleaseId: releaseId,
      });
    });
  return { activate, rows, run, sources, store, t };
}

describe("section store", () => {
  it("stores a new document with the vector, the model, and the scope of each section, and the version it was made from", async () => {
    const { rows, sources, store } = await setup();
    expect(
      await store(ACTIVE, [
        toStore(draft(0), vector),
        toStore(draft(1), otherVector),
      ])
    ).toEqual({ kept: 0, missing: 0, removed: 0, stale: false, written: 2 });
    expect(await rows()).toMatchObject([
      { embedding: vector, model: MODEL, ordinal: 0, scope: "id:material" },
      { embedding: otherVector, model: MODEL, ordinal: 1 },
    ]);
    expect(await sources()).toMatchObject([matrix]);
  });

  it("changes nothing, and writes nothing, when it stores the same document again", async () => {
    const { rows, run } = await setup();
    await run(ACTIVE, [toStore(draft(0), vector), toStore(draft(1), vector)]);
    const before = await rows();
    const again = await run(ACTIVE, [
      toStore(draft(0), otherVector),
      toStore(draft(1)),
    ]);
    expect(again.result).toEqual({
      kept: 2,
      missing: 0,
      removed: 0,
      stale: false,
      written: 0,
    });
    expect(again.metrics.documentsWritten.used).toBe(0);
    expect(await rows()).toEqual(before);
  });

  it("keeps the vector of a section whose text is the same but whose place or heading changed", async () => {
    const { rows, store } = await setup();
    await store(ACTIVE, [toStore(draft(0), vector)]);
    const [first] = await rows();
    expect(
      await store(ACTIVE, [
        toStore({ ...draft(0), count: 5, headingPath: ["Bab baru"] }),
      ])
    ).toEqual({ kept: 0, missing: 0, removed: 0, stale: false, written: 1 });
    expect(await rows()).toMatchObject([
      {
        _id: first?._id,
        count: 5,
        embedding: vector,
        headingPath: ["Bab baru"],
      },
    ]);
  });

  it("replaces a section whose text changed, in the place it had", async () => {
    const { rows, store } = await setup();
    await store(ACTIVE, [toStore(draft(0), vector)]);
    const [first] = await rows();
    await store(ACTIVE, [
      toStore({ ...draft(0, "sha256:second"), text: "Teks baru" }, otherVector),
    ]);
    const stored = await rows();
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({
      _id: first?._id,
      embedding: otherVector,
      hash: "sha256:second",
      text: "Teks baru",
    });
  });

  it("replaces a section made by another model", async () => {
    const { rows, store } = await setup();
    await store(ACTIVE, [toStore(draft(0), vector)]);
    await store(ACTIVE, [toStore(draft(0), otherVector)], {
      model: OTHER_MODEL,
    });
    expect(await rows()).toMatchObject([
      { embedding: otherVector, model: OTHER_MODEL },
    ]);
  });

  it("leaves out a section that comes without a vector and matches nothing, and deletes the outdated row it had", async () => {
    const { rows, store } = await setup();
    await store(ACTIVE, [toStore(draft(0), vector), toStore(draft(1), vector)]);
    expect(
      await store(ACTIVE, [
        toStore(draft(0)),
        toStore(draft(1, "sha256:second")),
        toStore(draft(2, "sha256:third")),
      ])
    ).toEqual({ kept: 1, missing: 2, removed: 1, stale: false, written: 0 });
    expect(await rows()).toMatchObject([{ hash: "sha256:first", ordinal: 0 }]);
  });

  it("deletes the rows of sections that the document no longer has, and only those of the document", async () => {
    const { rows, store } = await setup();
    await store(ACTIVE, [
      toStore(draft(0), vector),
      toStore(draft(1), vector),
      toStore(draft(2), vector),
    ]);
    await store(
      ACTIVE,
      [toStore({ ...draft(0), contentKey: "material/lesson/lain" }, vector)],
      {
        source: {
          ...matrix,
          contentKey: "material/lesson/lain",
        },
      }
    );
    expect(await store(ACTIVE, [toStore(draft(0)), toStore(draft(2))])).toEqual(
      { kept: 2, missing: 0, removed: 1, stale: false, written: 0 }
    );
    expect(
      Arr.map(await rows(), ({ contentKey, ordinal }) => [contentKey, ordinal])
    ).toEqual([
      [matrix.contentKey, 0],
      [matrix.contentKey, 2],
      ["material/lesson/lain", 0],
    ]);
  });

  it("empties a document that has no sections left, and records its version", async () => {
    const { rows, sources, store } = await setup();
    await store(ACTIVE, [toStore(draft(0), vector)]);
    expect(
      await store(ACTIVE, [], { source: { ...matrix, version: "second" } })
    ).toEqual({ kept: 0, missing: 0, removed: 1, stale: false, written: 0 });
    expect(await rows()).toEqual([]);
    expect(await sources()).toMatchObject([{ version: "second" }]);
  });

  it("records a new version in the place of the old one", async () => {
    const { sources, store } = await setup();
    await store(ACTIVE, [toStore(draft(0), vector)]);
    const [first] = await sources();
    await store(ACTIVE, [toStore(draft(0))], {
      source: { ...matrix, version: "second" },
    });
    expect(await sources()).toMatchObject([
      { _id: first?._id, version: "second" },
    ]);
  });

  it("records no version for a document that lacks a section, and deletes the version it held", async () => {
    const { rows, sources, store } = await setup();
    await store(ACTIVE, [
      toStore(draft(0), vector),
      toStore(draft(1, "sha256:second"), otherVector),
    ]);
    expect(await sources()).toMatchObject([matrix]);
    // The next version has a new text for the second section, which the model
    // left out: the first section is kept, the stale row of the second goes,
    // and the document has no version.
    const next = { ...matrix, version: "second" };
    expect(
      await store(
        ACTIVE,
        [toStore(draft(0), vector), draft(1, "sha256:third")],
        {
          source: next,
        }
      )
    ).toEqual({ kept: 1, missing: 1, removed: 1, stale: false, written: 0 });
    expect(await sources()).toEqual([]);
    expect(await rows()).toHaveLength(1);
  });

  it("records the version once the document holds every section again", async () => {
    const { sources, store } = await setup();
    await store(ACTIVE, [toStore(draft(0), vector), draft(1, "sha256:second")]);
    expect(await sources()).toEqual([]);
    const next = { ...matrix, version: "second" };
    expect(
      await store(
        ACTIVE,
        [
          toStore(draft(0), vector),
          toStore(draft(1, "sha256:second"), otherVector),
        ],
        { source: next }
      )
    ).toEqual({ kept: 1, missing: 0, removed: 0, stale: false, written: 1 });
    expect(await sources()).toMatchObject([next]);
  });

  it("stores nothing for a release that is not the active one", async () => {
    const { activate, rows, sources, store } = await setup();
    await activate("release-2");
    expect(await store(ACTIVE, [toStore(draft(0), vector)])).toEqual({
      kept: 0,
      missing: 0,
      removed: 0,
      stale: true,
      written: 0,
    });
    expect(await rows()).toEqual([]);
    expect(await sources()).toEqual([]);
  });

  it("stores nothing while no release is active", async () => {
    const t = createConvexTestWithBetterAuth();
    const result = await t.mutation((ctx) =>
      Effect.runPromise(
        storeDocument({
          model: MODEL,
          releaseId: ACTIVE,
          sections: [toStore(draft(0), vector)],
          source: matrix,
        }).pipe(
          Effect.provide(
            RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
          )
        )
      )
    );
    expect(result).toMatchObject({ stale: true, written: 0 });
  });

  it("keeps the vector of a section that another section pushed one place on, and embeds only the new one", async () => {
    const { rows, store } = await setup();
    await store(ACTIVE, [
      toStore(draft(0, "sha256:a"), vector),
      toStore(draft(1, "sha256:b"), otherVector),
      toStore(draft(2, "sha256:c"), vector),
    ]);
    // A new section comes before the second, so the second and the third move.
    expect(
      await store(ACTIVE, [
        toStore(draft(0, "sha256:a")),
        toStore(draft(1, "sha256:new"), newVector),
        toStore(draft(2, "sha256:b")),
        toStore(draft(3, "sha256:c")),
      ])
    ).toEqual({ kept: 1, missing: 0, removed: 0, stale: false, written: 3 });
    expect(
      Arr.map(await rows(), ({ embedding, hash, ordinal }) => [
        ordinal,
        hash,
        embedding,
      ])
    ).toEqual([
      [0, "sha256:a", vector],
      [1, "sha256:new", newVector],
      [2, "sha256:b", otherVector],
      [3, "sha256:c", vector],
    ]);
  });

  it("keeps the vector of a section that moved up when a section before it vanished, and deletes the row it left", async () => {
    const { rows, store } = await setup();
    await store(ACTIVE, [
      toStore(draft(0, "sha256:a"), vector),
      toStore(draft(1, "sha256:b"), otherVector),
      toStore(draft(2, "sha256:c"), newVector),
    ]);
    expect(
      await store(ACTIVE, [
        toStore(draft(0, "sha256:a")),
        toStore(draft(1, "sha256:c")),
      ])
    ).toEqual({ kept: 1, missing: 0, removed: 1, stale: false, written: 1 });
    expect(
      Arr.map(await rows(), ({ embedding, hash, ordinal }) => [
        ordinal,
        hash,
        embedding,
      ])
    ).toEqual([
      [0, "sha256:a", vector],
      [1, "sha256:c", newVector],
    ]);
  });

  it("does not take the vector of a section of another document, or of another model", async () => {
    const { rows, store } = await setup();
    await store(
      ACTIVE,
      [
        toStore(
          { ...draft(0, "sha256:a"), contentKey: "material/lesson/lain" },
          vector
        ),
      ],
      { source: { ...matrix, contentKey: "material/lesson/lain" } }
    );
    await store(ACTIVE, [toStore(draft(0, "sha256:b"), otherVector)], {
      model: OTHER_MODEL,
    });
    // The text of the first is stored in another document, the text of the
    // second by another model, and no new vector came with either.
    expect(
      await store(ACTIVE, [
        toStore(draft(0, "sha256:a")),
        toStore(draft(1, "sha256:b")),
      ])
    ).toEqual({ kept: 0, missing: 2, removed: 1, stale: false, written: 0 });
    expect(Arr.map(await rows(), ({ contentKey }) => contentKey)).toEqual([
      "material/lesson/lain",
    ]);
  });

  it("tells which texts a document holds, made by the model, at whatever place", async () => {
    const { store, t } = await setup();
    await store(ACTIVE, [
      toStore(draft(0, "sha256:a"), vector),
      toStore(draft(1, "sha256:b"), otherVector),
    ]);
    const ask = (
      model: string,
      hashes: readonly string[],
      contentKey = matrix.contentKey
    ) =>
      t.mutation((ctx) =>
        Effect.runPromise(
          knownSections({
            appLocale: "id",
            contentKey,
            hashes,
            model,
          }).pipe(
            Effect.provide(
              RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
            )
          )
        )
      );
    expect(await ask(MODEL, ["sha256:b", "sha256:c", "sha256:a"])).toEqual([
      true,
      false,
      true,
    ]);
    expect(await ask(OTHER_MODEL, ["sha256:a", "sha256:b"])).toEqual([
      false,
      false,
    ]);
    expect(await ask(MODEL, ["sha256:a"], "material/lesson/lain")).toEqual([
      false,
    ]);
  });
});
