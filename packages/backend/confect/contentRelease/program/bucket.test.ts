import { describe, expect, it } from "@effect/vitest";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { CONTENT_BUCKET_SIZE } from "@repo/backend/confect/contentRelease/bucket";
import { addProgramBucketRoute } from "@repo/backend/confect/contentRelease/program/bucket";
import { Confect, confectLayer } from "@repo/backend/confect/test.setup";
import { Effect } from "effect";

describe("contentRelease/program/bucket", () => {
  it.effect("creates and increments one snapshot-local sitemap partition", () =>
    Effect.gen(function* () {
      const t = yield* Confect;
      yield* t.run(
        Effect.gen(function* () {
          const reader = yield* DatabaseReader;
          yield* addProgramBucketRoute("snapshot", 4, "en", "abc");
          yield* addProgramBucketRoute("snapshot", 9, "en", "abc");
          expect(
            yield* reader
              .table("programBuckets")
              .get(
                "by_snapshotId_and_appLocale_and_bucket",
                "snapshot",
                "en",
                "abc"
              )
          ).toMatchObject({
            appLocale: "en",
            bucket: "abc",
            index: 4,
            routeCount: 2,
            snapshotId: "snapshot",
          });
        })
      );
    }).pipe(Effect.provide(confectLayer))
  );
  it.effect(
    "rejects invalid and overflowing sitemap partitions without writing them",
    () =>
      Effect.gen(function* () {
        const t = yield* Confect;
        yield* t.run(
          Effect.gen(function* () {
            const reader = yield* DatabaseReader;
            const writer = yield* DatabaseWriter;
            expect(
              yield* addProgramBucketRoute("snapshot", 0, "en", "invalid").pipe(
                Effect.flip
              )
            ).toMatchObject({ code: "CONTENT_RELEASE_INTEGRITY" });
            expect(
              yield* reader
                .table("programBuckets")
                .index("by_creation_time")
                .take(1)
            ).toEqual([]);
            const id = yield* writer.table("programBuckets").insert({
              appLocale: "en",
              bucket: "abc",
              index: 0,
              routeCount: CONTENT_BUCKET_SIZE,
              snapshotId: "snapshot",
            });
            expect(
              yield* addProgramBucketRoute("snapshot", 1, "en", "abc").pipe(
                Effect.flip
              )
            ).toMatchObject({ code: "CONTENT_RELEASE_LIMIT" });
            expect(yield* reader.table("programBuckets").get(id)).toMatchObject(
              { routeCount: CONTENT_BUCKET_SIZE }
            );
          })
        );
      }).pipe(Effect.provide(confectLayer))
  );
});
