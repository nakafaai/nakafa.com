import { assert, expect, it } from "@effect/vitest";
import {
  DatabaseReader,
  DatabaseWriter,
  MutationCtx,
} from "@repo/backend/confect/_generated/services";
import builds from "@repo/backend/confect/_generated/tables/contentModelBuilds";
import releases from "@repo/backend/confect/_generated/tables/contentReleases";
import { MODEL_BUILD_PAGE_ROWS } from "@repo/backend/confect/contentRelease/models/spec";
import { validateSearchModel } from "@repo/backend/confect/contentRelease/search/validation";
import { writeSearchEntry } from "@repo/backend/confect/contentRelease/search/write";
import { Confect, confectLayer } from "@repo/backend/confect/test.setup";
import { makeMaterialProjection } from "@repo/backend/test/content/material";
import { insertModelBuild } from "@repo/backend/test/content/model";
import {
  activateMaterialCatalog,
  MATERIAL_IDENTITY,
} from "@repo/backend/test/material/catalog";
import { Effect, Option, Schema } from "effect";

it.effect(
  "validates all search pages and rejects a stale row beyond the first page",
  () =>
    Effect.gen(function* () {
      const t = yield* Confect;
      const stored = yield* t.run(
        Effect.gen(function* () {
          const ctx = yield* MutationCtx;
          const reader = yield* DatabaseReader;
          const writer = yield* DatabaseWriter;
          const projections = Array.from(
            { length: MODEL_BUILD_PAGE_ROWS + 1 },
            (_, index) => makeMaterialProjection("en", index + 1)
          );
          yield* activateMaterialCatalog(projections);
          for (const projection of projections) {
            const head = yield* reader
              .table("contentHeads")
              .get(
                "by_contentKey_and_artifactLocale_and_sequence",
                projection.contentKey,
                "en",
                MATERIAL_IDENTITY.sequence
              );
            yield* writeSearchEntry(
              "green",
              head,
              projection,
              "Published lesson body"
            );
          }
          const build = yield* Effect.promise(() =>
            insertModelBuild(ctx, "searchVerify")
          );
          yield* writer.table("contentModelBuilds").patch(build._id, {
            releaseId: MATERIAL_IDENTITY.releaseId,
            manifestHash: MATERIAL_IDENTITY.manifestHash,
            sequence: MATERIAL_IDENTITY.sequence,
          });
          return {
            build: yield* reader.table("contentModelBuilds").get(build._id),
            release: yield* reader
              .table("contentReleases")
              .get("by_releaseId", MATERIAL_IDENTITY.releaseId),
          };
        }),
        Schema.Struct({ build: builds.Doc, release: releases.Doc })
      );
      const cursor = yield* t.run(
        Effect.gen(function* () {
          const page = yield* validateSearchModel(stored.build, stored.release);
          expect(page).toMatchObject({
            done: false,
            processed: MODEL_BUILD_PAGE_ROWS,
          });
          assert(page.cursor);
          return page.cursor;
        }),
        Schema.String
      );
      const next = { ...stored.build, cursor };
      yield* t.run(
        Effect.gen(function* () {
          expect(yield* validateSearchModel(next, stored.release)).toEqual({
            done: true,
            processed: 1,
            cursor: undefined,
          });
        })
      );
      yield* t.run(
        Effect.gen(function* () {
          const reader = yield* DatabaseReader;
          const writer = yield* DatabaseWriter;
          const last = yield* reader
            .table("contentIndex")
            .index(
              "by_slot_and_contentKey_and_appLocale",
              (index) => index.eq("slot", "green"),
              "desc"
            )
            .first();
          assert(Option.isSome(last));
          yield* writer.table("contentIndex").patch(last.value._id, {
            projectionHash: `sha256:${"f".repeat(64)}`,
          });
          expect(
            yield* validateSearchModel(next, stored.release).pipe(Effect.flip)
          ).toMatchObject({ code: "CONTENT_RELEASE_INTEGRITY" });
        })
      );
    }).pipe(Effect.provide(confectLayer))
);
