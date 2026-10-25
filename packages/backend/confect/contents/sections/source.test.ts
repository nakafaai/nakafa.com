import { RegisteredConvexFunction } from "@confect/server";
import { describe, expect, it } from "@effect/vitest";
import confectSchema from "@repo/backend/confect/_generated/schema";
import type { Source } from "@repo/backend/confect/contents/sections/schema";
import {
  findSource,
  holdsVersion,
} from "@repo/backend/confect/contents/sections/source";
import { createConvexTestWithBetterAuth } from "@repo/backend/confect/test.helpers";
import { Effect } from "effect";

const lesson: Source = {
  appLocale: "id",
  contentKey: "material/lesson/matematika/matriks",
  section: "material",
  version: "1:model:abc",
};

/** A deployment that holds the record of one document. */
async function setup() {
  const t = createConvexTestWithBetterAuth();
  await t.mutation((ctx) => ctx.db.insert("contentSectionSources", lesson));
  const find = (key: Pick<Source, "appLocale" | "contentKey">) =>
    t.mutation((ctx) =>
      Effect.runPromise(
        findSource(key).pipe(
          Effect.provide(
            RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
          )
        )
      )
    );
  const holds = (
    key: Pick<Source, "appLocale" | "contentKey">,
    version: string
  ) =>
    t.mutation((ctx) =>
      Effect.runPromise(
        holdsVersion(key, version).pipe(
          Effect.provide(
            RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
          )
        )
      )
    );
  return { find, holds, t };
}

describe("section sources", () => {
  it("finds the record of a document by its language and its identity", async () => {
    const { find } = await setup();
    expect(await find(lesson)).toMatchObject(lesson);
    expect(await find({ ...lesson, appLocale: "en" })).toBeNull();
    expect(
      await find({ ...lesson, contentKey: "material/lesson/lain" })
    ).toBeNull();
  });

  it("holds a version only when the record of the document names exactly it", async () => {
    const { holds } = await setup();
    expect(await holds(lesson, lesson.version)).toBe(true);
    expect(await holds(lesson, "1:model:abd")).toBe(false);
    expect(await holds({ ...lesson, appLocale: "de" }, lesson.version)).toBe(
      false
    );
  });

  it("does not hold the version of a record that counts the sections a document lacks", async () => {
    const { holds, t } = await setup();
    const partial = { ...lesson, contentKey: "material/lesson/lain" };
    await t.mutation((ctx) =>
      ctx.db.insert("contentSectionSources", { ...partial, missing: 1 })
    );
    expect(await holds(partial, lesson.version)).toBe(false);
  });
});
