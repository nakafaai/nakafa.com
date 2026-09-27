import { assert, describe, expect, it } from "@effect/vitest";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import builds from "@repo/backend/confect/_generated/tables/contentModelBuilds";
import { validateMaterialModel } from "@repo/backend/confect/contentRelease/material/validation";
import { reconcileMaterialModel } from "@repo/backend/confect/contentRelease/models/material";
import { MODEL_BUILD_PAGE_ROWS } from "@repo/backend/confect/contentRelease/models/spec";
import { Confect, confectLayer } from "@repo/backend/confect/test.setup";
import { makeMaterialProjection } from "@repo/backend/test/content/material";
import {
  activateMaterialCatalog,
  MATERIAL_IDENTITY,
} from "@repo/backend/test/material/catalog";
import { Effect, Schema } from "effect";

describe("inactive material validation pages", () => {
  it.effect(
    "reconciles and verifies every candidate projection across a durable page boundary",
    () =>
      Effect.gen(function* () {
        const t = yield* Confect;
        const stored = yield* t.run(
          Effect.gen(function* () {
            const writer = yield* DatabaseWriter;
            const reader = yield* DatabaseReader;
            yield* activateMaterialCatalog(
              Array.from({ length: MODEL_BUILD_PAGE_ROWS + 1 }, (_, index) =>
                makeMaterialProjection("en", index + 1)
              )
            );
            const id = yield* writer.table("contentModelBuilds").insert({
              base: { kind: "release", ...MATERIAL_IDENTITY },
              generation: 1,
              itemIndex: -1,
              key: "primary",
              manifestHash: MATERIAL_IDENTITY.manifestHash,
              phase: "materialCatalog",
              releaseId: MATERIAL_IDENTITY.releaseId,
              sequence: MATERIAL_IDENTITY.sequence,
              updatedAt: 1,
              slots: {
                articleBaseSlot: "blue",
                articleTargetSlot: "blue",
                materialBaseSlot: "blue",
                materialTargetSlot: "green",
                searchBaseSlot: "blue",
                searchTargetSlot: "green",
              },
            });
            return yield* reader.table("contentModelBuilds").get(id);
          }),
          builds.Doc
        );
        const copyCursor = yield* t.run(
          Effect.gen(function* () {
            const page = yield* reconcileMaterialModel(stored);
            expect(page).toMatchObject({
              done: false,
              processed: MODEL_BUILD_PAGE_ROWS,
            });
            assert(page.cursor !== undefined);
            return page.cursor;
          }),
          Schema.String
        );
        yield* t.run(
          Effect.gen(function* () {
            expect(
              yield* reconcileMaterialModel({ ...stored, cursor: copyCursor })
            ).toMatchObject({ done: true, processed: 1 });
          })
        );
        const verifyCursor = yield* t.run(
          Effect.gen(function* () {
            const page = yield* validateMaterialModel({
              ...stored,
              phase: "materialVerify",
            });
            expect(page).toMatchObject({
              done: false,
              processed: MODEL_BUILD_PAGE_ROWS,
            });
            assert(page.cursor !== undefined);
            return page.cursor;
          }),
          Schema.String
        );
        yield* t.run(
          Effect.gen(function* () {
            expect(
              yield* validateMaterialModel({
                ...stored,
                cursor: verifyCursor,
                phase: "materialVerify",
              })
            ).toEqual({ cursor: undefined, done: true, processed: 1 });
          })
        );
      }).pipe(Effect.provide(confectLayer))
  );
});
