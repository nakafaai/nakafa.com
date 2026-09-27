import { assert, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  MutationCtx,
} from "@repo/backend/confect/_generated/services";
import { encodePageCursor } from "@repo/backend/confect/contentRelease/cursor";
import { Confect, confectLayer } from "@repo/backend/confect/test.setup";
import { makeMaterialProjection } from "@repo/backend/test/content/material";
import {
  activateMaterialCatalog,
  advanceMaterialCatalog,
  MATERIAL_IDENTITY,
} from "@repo/backend/test/material/catalog";
import { insertRuntimeBinding } from "@repo/backend/test/runtime/head";
import { Effect, Schema } from "effect";

const publications = refs.public.contentRelease.material.publications;
const initial = {
  appLocale: "en",
  expectedManifestHash: null,
  expectedReleaseId: null,
  paginationOpts: { cursor: null, numItems: 1 },
} as const;
const current = {
  ...initial,
  expectedManifestHash: MATERIAL_IDENTITY.manifestHash,
  expectedReleaseId: MATERIAL_IDENTITY.releaseId,
};

describe("contentRelease/material/page", () => {
  it.effect("rejects forged material positions and cross-locale reuse", () =>
    Effect.gen(function* () {
      const confect = yield* Confect;
      yield* confect.run(activateMaterialCatalog());
      const first = yield* confect.query(publications, initial);
      for (const cursor of [
        "publication-page:{",
        encodePageCursor("category", "blue", "unused"),
        encodePageCursor("material", "green", "unused"),
        encodePageCursor("material", "blue", "material-route|{"),
        encodePageCursor(
          "material",
          "blue",
          'material-route|["green","en","/en/materials/algebra"]'
        ),
      ]) {
        expect(
          yield* confect
            .query(publications, {
              ...current,
              paginationOpts: { cursor, numItems: 1 },
            })
            .pipe(Effect.flip)
        ).toMatchObject({
          _tag: "ReleaseError",
          code: "CONTENT_RELEASE_INTEGRITY",
        });
      }
      expect(
        yield* confect
          .query(publications, {
            ...current,
            appLocale: "de",
            paginationOpts: {
              cursor: first.result.continueCursor,
              numItems: 1,
            },
          })
          .pipe(Effect.flip)
      ).toMatchObject({
        _tag: "ReleaseError",
        code: "CONTENT_RELEASE_INTEGRITY",
      });
    }).pipe(Effect.provide(confectLayer))
  );
  it.effect(
    "resumes a native cursor issued for the current material index",
    () =>
      Effect.gen(function* () {
        const confect = yield* Confect;
        yield* confect.run(activateMaterialCatalog());
        const issued = yield* confect.run(
          Effect.gen(function* () {
            const reader = yield* DatabaseReader;
            const page = yield* reader
              .table("materialCatalog")
              .index("by_slot_and_appLocale_and_publicPath", (q) =>
                q.eq("slot", "blue").eq("appLocale", "en")
              )
              .paginate({ cursor: null, numItems: 1 });
            expect(page.isDone).toBe(false);
            const row = page.page[0];
            assert(row);
            return {
              cursor: page.continueCursor,
              projectionJson: row.projectionJson,
            };
          }),
          Schema.Struct({
            cursor: Schema.String,
            projectionJson: Schema.String,
          })
        );
        const next = yield* confect.query(publications, {
          ...current,
          paginationOpts: {
            cursor: encodePageCursor("material", "blue", issued.cursor),
            numItems: 1,
          },
        });
        expect(next).toMatchObject({
          managed: true,
          stale: false,
          result: { isDone: true, page: [expect.any(String)] },
        });
        expect(next.result.page[0]).not.toBe(issued.projectionJson);
      }).pipe(Effect.provide(confectLayer))
  );
  it.effect("returns an empty unmanaged page before material publication", () =>
    Effect.gen(function* () {
      const confect = yield* Confect;
      expect(yield* confect.query(publications, initial)).toMatchObject({
        managed: false,
        result: { isDone: true, page: [] },
        stale: false,
      });
    }).pipe(Effect.provide(confectLayer))
  );
  it.effect("paginates verified materials under one release identity", () =>
    Effect.gen(function* () {
      const confect = yield* Confect;
      yield* confect.run(activateMaterialCatalog());
      const first = yield* confect.query(publications, initial);
      expect(first).toMatchObject({
        activeManifestHash: MATERIAL_IDENTITY.manifestHash,
        activeReleaseId: MATERIAL_IDENTITY.releaseId,
        managed: true,
        result: { isDone: false, page: [expect.any(String)] },
        sourceRevision: "a".repeat(40),
        stale: false,
      });
      const second = yield* confect.query(publications, {
        ...current,
        paginationOpts: { cursor: first.result.continueCursor, numItems: 1 },
      });
      expect(second).toMatchObject({
        managed: true,
        result: { isDone: true, page: [expect.any(String)] },
        stale: false,
      });
      expect(second.result.page[0]).not.toBe(first.result.page[0]);
    }).pipe(Effect.provide(confectLayer))
  );
  it.effect(
    "returns a stable stale page for a superseded cursor identity",
    () =>
      Effect.gen(function* () {
        const confect = yield* Confect;
        yield* confect.run(activateMaterialCatalog());
        const first = yield* confect.query(publications, initial);
        expect(
          yield* confect.query(publications, {
            ...initial,
            expectedManifestHash: "stale",
            expectedReleaseId: "stale",
            paginationOpts: {
              cursor: first.result.continueCursor,
              numItems: 1,
            },
          })
        ).toMatchObject({
          managed: true,
          result: { isDone: true, page: [] },
          stale: true,
        });
      }).pipe(Effect.provide(confectLayer))
  );
  it.effect("restarts a native cursor from the retired index query", () =>
    Effect.gen(function* () {
      const confect = yield* Confect;
      yield* confect.run(activateMaterialCatalog());
      expect(
        yield* confect.query(publications, {
          ...current,
          paginationOpts: { cursor: "retired-native-cursor", numItems: 1 },
        })
      ).toMatchObject({
        managed: true,
        result: { isDone: true, page: [] },
        stale: true,
      });
    }).pipe(Effect.provide(confectLayer))
  );
  it.effect("rejects catalog rows removed from the effective publication", () =>
    Effect.gen(function* () {
      const confect = yield* Confect;
      yield* confect.run(
        Effect.gen(function* () {
          const ctx = yield* MutationCtx;
          const removed = makeMaterialProjection("en", 1);
          yield* activateMaterialCatalog();
          yield* Effect.promise(() =>
            insertRuntimeBinding(ctx, null, {
              appLocale: removed.appLocale,
              bindingReleaseId: "release-next",
              bindingSequence: 2,
              publicPath: removed.publicPath,
            })
          );
          yield* advanceMaterialCatalog();
        })
      );
      expect(
        yield* confect
          .query(publications, {
            ...initial,
            paginationOpts: { cursor: null, numItems: 2 },
          })
          .pipe(Effect.flip)
      ).toMatchObject({
        _tag: "ReleaseError",
        code: "CONTENT_RELEASE_ROUTE",
      });
    }).pipe(Effect.provide(confectLayer))
  );
  it.effect("rejects caller-owned end cursors", () =>
    Effect.gen(function* () {
      const confect = yield* Confect;
      expect(
        yield* confect
          .query(publications, {
            ...initial,
            paginationOpts: {
              cursor: null,
              endCursor: "caller-owned",
              numItems: 1,
            },
          })
          .pipe(Effect.flip)
      ).toMatchObject({ _tag: "ReleaseError", code: "CONTENT_RELEASE_LIMIT" });
    }).pipe(Effect.provide(confectLayer))
  );
});
