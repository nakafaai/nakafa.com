import { RegisteredConvexFunction } from "@confect/server";
import { assert, describe, expect, it } from "@effect/vitest";
import confectSchema from "@repo/backend/confect/_generated/schema";
import { PRUNE_BATCH_SIZE } from "@repo/backend/confect/contents/sections/limits";
import type {
  SectionDraft,
  storedSectionValidator,
} from "@repo/backend/confect/contents/sections/schema";
import {
  knownSections,
  pruneSections,
  storeSections,
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

/** A section in the Indonesian lesson of the fixture, told apart by its place. */
function draft(ordinal: number, hash = "sha256:first"): SectionDraft {
  return {
    anchor: `bagian-${ordinal}`,
    appLocale: "id",
    contentKey: "material/lesson/matematika/matriks",
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
  const store = (
    releaseId: string,
    sections: readonly (typeof storedSectionValidator.Type)[],
    model = MODEL
  ) =>
    t.mutation((ctx) =>
      Effect.runPromise(
        storeSections({ model, releaseId, sections }).pipe(
          Effect.provide(
            RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
          )
        )
      )
    );
  const rows = () =>
    t.query((ctx) => ctx.db.query("contentSections").collect());
  /** Makes another release the active one, as an activation does. */
  const activate = (releaseId: string) =>
    t.mutation(async (ctx) => {
      const state = await ctx.db.query("contentState").unique();
      assert.ok(state, "Expected one active content state.");
      await ctx.db.patch("contentState", state._id, {
        activeReleaseId: releaseId,
      });
    });
  /** Leaves a row that an earlier build made for any release. */
  const leave = (releaseId: string, section: SectionDraft) =>
    t.mutation((ctx) =>
      ctx.db.insert("contentSections", {
        ...section,
        embedding: vector,
        headingPath: Arr.fromIterable(section.headingPath),
        model: MODEL,
        releaseId,
        scope: "id:material",
      })
    );
  return { activate, leave, rows, store, t };
}

describe("section store", () => {
  it("stores a new section with its vector, its model, its release, and its scope", async () => {
    const { rows, store } = await setup();
    expect(await store(ACTIVE, [toStore(draft(0), vector)])).toEqual({
      kept: 0,
      missing: 0,
      stale: false,
      written: 1,
    });
    expect(await rows()).toMatchObject([
      {
        embedding: vector,
        model: MODEL,
        ordinal: 0,
        releaseId: ACTIVE,
        scope: "id:material",
      },
    ]);
  });

  it("changes nothing when it stores the same sections again", async () => {
    const { rows, store } = await setup();
    await store(ACTIVE, [toStore(draft(0), vector)]);
    const before = await rows();
    expect(await store(ACTIVE, [toStore(draft(0), otherVector)])).toEqual({
      kept: 1,
      missing: 0,
      stale: false,
      written: 0,
    });
    expect(await rows()).toEqual(before);
  });

  it("moves an unchanged section to a new release and keeps its vector", async () => {
    const { activate, rows, store } = await setup();
    await store(ACTIVE, [toStore(draft(0), vector)]);
    await activate("release-2");
    expect(await store("release-2", [toStore(draft(0))])).toEqual({
      kept: 0,
      missing: 0,
      stale: false,
      written: 1,
    });
    expect(await rows()).toMatchObject([
      { embedding: vector, releaseId: "release-2" },
    ]);
  });

  it("replaces a section whose text changed, in the place it had", async () => {
    const { activate, rows, store } = await setup();
    await store(ACTIVE, [toStore(draft(0), vector)]);
    const [first] = await rows();
    await activate("release-2");
    await store("release-2", [
      toStore({ ...draft(0, "sha256:second"), text: "Teks baru" }, otherVector),
    ]);
    const stored = await rows();
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({
      _id: first?._id,
      embedding: otherVector,
      hash: "sha256:second",
      releaseId: "release-2",
      text: "Teks baru",
    });
  });

  it("replaces a section made by another model", async () => {
    const { rows, store } = await setup();
    await store(ACTIVE, [toStore(draft(0), vector)]);
    await store(ACTIVE, [toStore(draft(0), otherVector)], OTHER_MODEL);
    expect(await rows()).toMatchObject([
      { embedding: otherVector, model: OTHER_MODEL },
    ]);
  });

  it("cannot keep a section that comes without a vector and matches nothing stored", async () => {
    const { activate, rows, store } = await setup();
    await store(ACTIVE, [toStore(draft(0), vector)]);
    await activate("release-2");
    expect(
      await store("release-2", [
        toStore(draft(1)),
        toStore(draft(0, "sha256:second")),
      ])
    ).toEqual({ kept: 0, missing: 2, stale: false, written: 0 });
    expect(await store("release-2", [toStore(draft(0))], OTHER_MODEL)).toEqual({
      kept: 0,
      missing: 1,
      stale: false,
      written: 0,
    });
    expect(await rows()).toMatchObject([{ releaseId: ACTIVE }]);
  });

  it("stores nothing for a release that is not the active one", async () => {
    const { activate, rows, store } = await setup();
    await activate("release-2");
    expect(await store(ACTIVE, [toStore(draft(0), vector)])).toEqual({
      kept: 0,
      missing: 0,
      stale: true,
      written: 0,
    });
    expect(await rows()).toEqual([]);
  });

  it("stores nothing while no release is active", async () => {
    const t = createConvexTestWithBetterAuth();
    const result = await t.mutation((ctx) =>
      Effect.runPromise(
        storeSections({
          model: MODEL,
          releaseId: ACTIVE,
          sections: [toStore(draft(0), vector)],
        }).pipe(
          Effect.provide(
            RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
          )
        )
      )
    );
    expect(result).toMatchObject({ stale: true, written: 0 });
  });

  it("tells which sections the index holds with the same text and model", async () => {
    const { store, t } = await setup();
    await store(ACTIVE, [toStore(draft(0), vector)]);
    const ask = (model: string) =>
      t.mutation((ctx) =>
        Effect.runPromise(
          knownSections({
            model,
            sections: [draft(0), draft(0, "sha256:second"), draft(1)],
          }).pipe(
            Effect.provide(
              RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
            )
          )
        )
      );
    expect(await ask(MODEL)).toEqual([true, false, false]);
    expect(await ask(OTHER_MODEL)).toEqual([false, false, false]);
  });
});

describe("section prune", () => {
  function prune(
    t: ReturnType<typeof createConvexTestWithBetterAuth>,
    releaseId: string
  ) {
    return t.mutation((ctx) =>
      Effect.runPromise(
        pruneSections({ releaseId }).pipe(
          Effect.provide(
            RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
          )
        )
      )
    );
  }

  it("deletes the rows of earlier and later releases and keeps those of the active one", async () => {
    const { leave, rows, t } = await setup();
    await leave("release-0", draft(0));
    await leave(ACTIVE, draft(1));
    await leave("zzz-later", draft(2));
    expect(await prune(t, ACTIVE)).toEqual({ deleted: 2, done: true });
    expect(await rows()).toMatchObject([{ releaseId: ACTIVE }]);
  });

  it("deletes a bounded batch and reports when more are left", async () => {
    const { leave, rows, t } = await setup();
    for (const ordinal of Arr.range(0, PRUNE_BATCH_SIZE)) {
      await leave("release-0", draft(ordinal));
    }
    await leave(ACTIVE, draft(PRUNE_BATCH_SIZE + 1));
    expect(await prune(t, ACTIVE)).toEqual({
      deleted: PRUNE_BATCH_SIZE,
      done: false,
    });
    expect(await rows()).toHaveLength(2);
    expect(await prune(t, ACTIVE)).toEqual({ deleted: 1, done: true });
    expect(await rows()).toMatchObject([{ releaseId: ACTIVE }]);
  });

  it("deletes nothing for a release that is not the active one", async () => {
    const { leave, rows, t } = await setup();
    await leave("release-0", draft(0));
    expect(await prune(t, "release-0")).toEqual({ deleted: 0, done: true });
    expect(await rows()).toHaveLength(1);
  });

  it("deletes nothing while no release is active", async () => {
    const t = createConvexTestWithBetterAuth();
    expect(await prune(t, "release-0")).toEqual({ deleted: 0, done: true });
  });
});
