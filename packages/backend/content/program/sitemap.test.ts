import { describe, expect, it } from "@effect/vitest";
import { MutationCtx } from "@repo/backend/confect/_generated/services";
import { CONTENT_BUCKET_LIMIT } from "@repo/backend/confect/contentRelease/bucket";
import { Confect, confectLayer } from "@repo/backend/confect/test.setup";
import { programLayer } from "@repo/backend/content/program/confect";
import {
  readProgramBuckets,
  readProgramSitemap,
} from "@repo/backend/content/program/sitemap";
import {
  activateProgramSnapshot,
  makeProgramSnapshotData,
} from "@repo/backend/test/program/snapshot";
import { Array as Arr, Effect } from "effect";

describe("contentRelease/program/sitemap", () => {
  it.effect("rejects an index larger than the complete partition space", () =>
    Effect.gen(function* () {
      const data = yield* makeProgramSnapshotData();
      const target = yield* Confect.pipe(Effect.provide(confectLayer));
      yield* target.run(
        Effect.gen(function* () {
          const targetCtx = yield* MutationCtx;
          yield* activateProgramSnapshot(data);
          for (let index = 0; index <= CONTENT_BUCKET_LIMIT; index += 1) {
            yield* Effect.promise(() =>
              targetCtx.db.insert("programBuckets", {
                appLocale: "en",
                bucket: "aaa",
                index: index + 100,
                routeCount: 1,
                snapshotId: data.snapshotId,
              })
            );
          }
          expect(
            yield* readProgramBuckets("en").pipe(
              Effect.provide(programLayer),
              Effect.flip
            )
          ).toMatchObject({
            code: "CONTENT_RELEASE_INTEGRITY",
          });
        })
      );
    })
  );
  it.effect("returns empty unmanaged discovery and no unmanaged page", () =>
    Effect.gen(function* () {
      const target = yield* Confect.pipe(Effect.provide(confectLayer));
      yield* target.run(
        Effect.gen(function* () {
          const _targetCtx = yield* MutationCtx;
          expect(
            yield* readProgramBuckets("en").pipe(Effect.provide(programLayer))
          ).toEqual({
            buckets: [],
            managed: false,
            routeCount: 0,
          });
          expect(
            yield* readProgramSitemap("en", "abc").pipe(
              Effect.provide(programLayer)
            )
          ).toBeNull();
        })
      );
    })
  );
  it.live("lists and reads complete active curriculum sitemap partitions", () =>
    Effect.gen(function* () {
      const data = yield* makeProgramSnapshotData();
      const target = yield* Confect.pipe(Effect.provide(confectLayer));
      yield* target.run(
        Effect.gen(function* () {
          const _targetCtx = yield* MutationCtx;
          yield* activateProgramSnapshot(data);
          const result = yield* readProgramBuckets("en").pipe(
            Effect.provide(programLayer)
          );
          expect(result).toMatchObject({
            managed: true,
            routeCount: 2,
          });
          expect(result.buckets.length).toBeGreaterThan(0);
          const pages = yield* Effect.forEach(result.buckets, (bucket) =>
            readProgramSitemap("en", bucket).pipe(Effect.provide(programLayer))
          );
          expect(Arr.flatMap(pages, (page) => page?.routes ?? [])).toEqual(
            expect.arrayContaining([
              {
                publicPath: "curriculum/technical-program-1",
              },
              {
                publicPath: "curriculum/technical-program-2",
              },
            ])
          );
        })
      );
    })
  );
  it.live("rejects malformed stored partition metadata", () =>
    Effect.gen(function* () {
      const data = yield* makeProgramSnapshotData();
      const target = yield* Confect.pipe(Effect.provide(confectLayer));
      yield* target.run(
        Effect.gen(function* () {
          const targetCtx = yield* MutationCtx;
          yield* activateProgramSnapshot(data);
          yield* Effect.promise(() =>
            targetCtx.db.insert("programBuckets", {
              appLocale: "en",
              bucket: "invalid",
              index: 100,
              routeCount: 0,
              snapshotId: data.snapshotId,
            })
          );
          expect(
            yield* readProgramBuckets("en").pipe(
              Effect.provide(programLayer),
              Effect.flip
            )
          ).toMatchObject({
            code: "CONTENT_RELEASE_INTEGRITY",
          });
        })
      );
    })
  );
});
