import { describe, expect, it } from "@effect/vitest";
import { convexPublicationLayer } from "@repo/backend/content/publication/convex";
import { resolvePublicRoute } from "@repo/backend/content/publication/public";
import { readActiveIdentity } from "@repo/backend/content/publication/read";
import { snapshotPublicationLayer } from "@repo/backend/content/publication/snapshot";
import { PublicationSource } from "@repo/backend/content/publication/source";
import { projectActiveRuntime } from "@repo/backend/content/snapshot/projection";
import { CONTENT_RUNTIME_TABLES } from "@repo/backend/content/snapshot/tables";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { makePageRuntimeSource } from "@repo/backend/test/content/snapshot";
import { convexTest } from "convex-test";
import { Effect, Option } from "effect";

const fixture = Effect.fn("test.publicationSnapshot")(function* () {
  const source = makePageRuntimeSource();
  return { ...source, tables: yield* projectActiveRuntime(source.source) };
});

describe("immutable publication source", () => {
  it.effect(
    "returns the same active identity and inherited public bytes as native Convex",
    () =>
      Effect.gen(function* () {
        const { tables, projection } = yield* fixture();
        const target = convexTest(schema, convexModules);
        yield* Effect.promise(() =>
          target.mutation(async (ctx) => {
            for (const table of CONTENT_RUNTIME_TABLES) {
              for (const row of tables[table]) {
                await ctx.db.insert(table, row);
              }
            }
          })
        );
        const program = Effect.all({
          identity: readActiveIdentity(),
          body: resolvePublicRoute(projection.appLocale, projection.publicPath),
        });
        const native = yield* Effect.promise(() =>
          target.query((ctx) =>
            runConvexProgram(
              program.pipe(Effect.provide(convexPublicationLayer(ctx)))
            )
          )
        );
        const portable = yield* program.pipe(
          Effect.provide(snapshotPublicationLayer(tables))
        );
        expect(portable).toEqual(native);
        expect(portable.body?.artifactJson).toBe(
          tables.contentArtifacts[0]?.artifactJson
        );
      })
  );

  it.effect(
    "keeps lookups bounded to the selected generation and returns explicit absence",
    () =>
      Effect.gen(function* () {
        const { tables, projection, state } = yield* fixture();
        const family = {
          family: "quran",
          snapshotId: "immutable-family",
          snapshotJson: "opaque stored bytes",
          createdAt: 1,
          retainUntil: 2,
        } as const;
        const keys = [
          {
            family: "page",
            contentKey: "page/z",
            artifactLocale: "en",
            createdSequence: 8,
          },
          {
            family: "page",
            contentKey: "page/b",
            artifactLocale: "en",
            createdSequence: 7,
          },
          {
            family: "page",
            contentKey: "page/a",
            artifactLocale: "en",
            createdSequence: 7,
          },
        ] as const;
        yield* Effect.gen(function* () {
          const source = yield* PublicationSource;
          expect(Option.getOrNull(yield* source.state)).toEqual(state);
          expect(yield* source.release(state.activeReleaseId)).toEqual(
            tables.contentReleases[0]
          );
          expect(
            Option.getOrNull(yield* source.snapshot("quran", family.snapshotId))
          ).toEqual(family);
          expect(
            Option.isNone(yield* source.snapshot("quran", "missing"))
          ).toBe(true);
          expect(
            Option.isNone(
              yield* source.version("missing", projection.artifactLocale, 9)
            )
          ).toBe(true);
          expect(Option.isNone(yield* source.binding("en", "missing", 9))).toBe(
            true
          );
          expect(Option.isNone(yield* source.artifact("missing"))).toBe(true);
          expect(yield* source.pageKeys("en", 9, 2)).toEqual([
            keys[2],
            keys[1],
          ]);
          expect(yield* source.pageKeys("id", 9, 2)).toEqual([]);
          expect(
            yield* source.release("missing").pipe(Effect.flip)
          ).toMatchObject({ code: "CONTENT_RELEASE_MISSING" });
          const failures = yield* Effect.all([
            source.pageKeys("en", 8, 1).pipe(Effect.flip),
            source.binding("en", projection.publicPath, 8).pipe(Effect.flip),
            source
              .version(projection.contentKey, projection.artifactLocale, 10)
              .pipe(Effect.flip),
          ]);
          for (const failure of failures) {
            expect(failure).toMatchObject({ code: "CONTENT_RELEASE_STATE" });
          }
        }).pipe(
          Effect.provide(
            snapshotPublicationLayer({
              ...tables,
              contentSnapshots: [family],
              contentKeys: keys,
            })
          )
        );
      })
  );

  it.effect("rejects missing, partial and duplicate selected state", () =>
    Effect.gen(function* () {
      const { tables, state } = yield* fixture();
      for (const contentState of [
        [],
        [state, state],
        [{ ...state, activeReleaseId: "" }],
        [{ ...state, activeSequence: undefined }],
      ]) {
        expect(
          yield* PublicationSource.pipe(
            Effect.provide(
              snapshotPublicationLayer({ ...tables, contentState })
            ),
            Effect.flip
          )
        ).toMatchObject({ code: "CONTENT_RELEASE_STATE" });
      }
    })
  );

  it.effect(
    "rejects conflicting immutable identities and unselected page keys",
    () =>
      Effect.gen(function* () {
        const { tables } = yield* fixture();
        expect(
          yield* PublicationSource.pipe(
            Effect.provide(
              snapshotPublicationLayer({
                ...tables,
                contentHeads: [...tables.contentHeads, ...tables.contentHeads],
              })
            ),
            Effect.flip
          )
        ).toMatchObject({ code: "CONTENT_RELEASE_INTEGRITY" });
        for (const key of [
          {
            family: "article",
            contentKey: "article/one",
            artifactLocale: "en",
            createdSequence: 7,
          },
          {
            family: "page",
            contentKey: "page/future",
            artifactLocale: "en",
            createdSequence: 10,
          },
        ] as const) {
          expect(
            yield* PublicationSource.pipe(
              Effect.provide(
                snapshotPublicationLayer({
                  ...tables,
                  contentKeys: [key],
                })
              ),
              Effect.flip
            )
          ).toMatchObject({ code: "CONTENT_RELEASE_INTEGRITY" });
        }
      })
  );

  it.effect(
    "does not expose future heads or bindings through the current generation",
    () =>
      Effect.gen(function* () {
        const { tables, projection } = yield* fixture();
        yield* Effect.gen(function* () {
          const source = yield* PublicationSource;
          expect(
            yield* source
              .version(projection.contentKey, projection.artifactLocale, 9)
              .pipe(Effect.flip)
          ).toMatchObject({ code: "CONTENT_RELEASE_INTEGRITY" });
          expect(
            yield* source
              .binding(projection.appLocale, projection.publicPath, 9)
              .pipe(Effect.flip)
          ).toMatchObject({ code: "CONTENT_RELEASE_INTEGRITY" });
        }).pipe(
          Effect.provide(
            snapshotPublicationLayer({
              ...tables,
              contentHeads: tables.contentHeads.map((row) => ({
                ...row,
                sequence: 10,
              })),
              contentBindings: tables.contentBindings.map((row) => ({
                ...row,
                sequence: 10,
              })),
            })
          )
        );
      })
  );
});
