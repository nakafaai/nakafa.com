import { describe, expect, it } from "@effect/vitest";
import {
  canonicalizeContentProjection,
  familyForProjection,
} from "@nakafa/aksara-contracts/projection/spec";
import { projectActiveRuntime } from "@repo/backend/content/snapshot/projection";
import {
  CONTENT_RUNTIME_TABLES,
  type RuntimeRow,
} from "@repo/backend/content/snapshot/tables";
import { writeArticle } from "@repo/backend/convex/contentRelease/article/write";
import { writeMaterial } from "@repo/backend/convex/contentRelease/material/write";
import { decodeProjectionJson } from "@repo/backend/convex/contentRelease/parse";
import { writeSearchEntry } from "@repo/backend/convex/contentRelease/search/write";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { testProjectionJson } from "@repo/backend/test/content/material";
import { testSignedArtifact } from "@repo/backend/test/content/proof";
import {
  testRouteJson,
  testTextHash,
} from "@repo/backend/test/content/release";
import { testArticleProjection } from "@repo/backend/test/content/runtime";
import { makeRuntimeSource } from "@repo/backend/test/content/snapshot";
import { convexTest } from "convex-test";
import { Effect } from "effect";

const catalogSource = Effect.fn("RuntimeCatalogTest.source")(function* () {
  const fixture = makeRuntimeSource();
  const t = convexTest(schema, convexModules);
  const material = yield* decodeProjectionJson(testProjectionJson());
  const projections = [testArticleProjection(0), material];
  yield* Effect.promise(() =>
    t.mutation(async (ctx) => {
      for (const projection of projections) {
        if (
          projection.kind !== "article" &&
          projection.kind !== "subject-lesson"
        ) {
          throw new Error("Expected a technical catalog projection.");
        }
        const rendererDomain =
          projection.kind === "article" ? "politics" : "mathematics";
        const artifact = testSignedArtifact(rendererDomain, {
          contentKey: projection.contentKey,
        });
        const projectionJson = canonicalizeContentProjection(projection);
        const head = {
          artifactHash: artifact.artifactHash,
          artifactLocale: projection.artifactLocale,
          compilerConfigHash: artifact.payload.compilerConfigHash,
          contentKey: projection.contentKey,
          delivery: "public",
          family: familyForProjection(projection),
          index: 0,
          operation: "upsert",
          projectionHash: testTextHash(projectionJson),
          projectionJson,
          releaseId: "inherited",
          rendererDomain,
          sequence: 7,
          sourceHash: artifact.payload.sourceHash,
          sourcePath: `packages/corpus/${projection.contentKey}/${projection.artifactLocale}.mdx`,
        } satisfies RuntimeRow<"contentHeads">;
        await ctx.db.insert("contentHeads", head);
        await ctx.db.insert("contentArtifacts", {
          artifactHash: artifact.artifactHash,
          artifactJson: JSON.stringify(artifact),
          createdAt: 1,
          retainUntil: 100,
        });
        await ctx.db.insert("contentBindings", {
          appLocale: projection.appLocale,
          batchHash: testTextHash("batch"),
          batchIndex: 0,
          contentKey: projection.contentKey,
          index: 0,
          operation: "bind",
          publicPath: projection.publicPath,
          releaseId: "inherited",
          sequence: 7,
          routeJson: testRouteJson({
            contentKey: projection.contentKey,
            publicPath: projection.publicPath,
          }),
        });
        await runConvexProgram(
          writeSearchEntry(
            ctx,
            "blue",
            head,
            projection,
            artifact.payload.plainText
          )
        );
        if (projection.kind === "article") {
          await runConvexProgram(writeArticle(ctx, "blue", head, projection));
        } else {
          await runConvexProgram(
            writeMaterial(
              ctx,
              "blue",
              {
                ...head,
                appLocale: projection.appLocale,
                publicPath: projection.publicPath,
              },
              projection
            )
          );
        }
      }
    })
  );
  for (const table of CONTENT_RUNTIME_TABLES) {
    if (table !== "contentState" && table !== "contentReleases") {
      fixture.source.set(
        table,
        yield* Effect.promise(() =>
          t.query((ctx) => ctx.db.query(table).collect())
        )
      );
    }
  }
  return fixture;
});

describe("active catalog closure", () => {
  it.effect(
    "keeps current slots with inherited head provenance and omits all inactive rows",
    () =>
      Effect.gen(function* () {
        const { source } = yield* catalogSource();
        for (const table of [
          "contentIndex",
          "articleCatalog",
          "articleCategories",
          "articleBuckets",
          "materialCatalog",
          "materialBuckets",
        ] as const) {
          const rows = source.get(table) ?? [];
          source.set(table, [
            ...rows,
            ...rows.map((row) => ({ ...row, slot: "green" })),
          ]);
        }
        const result = yield* projectActiveRuntime(source);
        expect(result.contentIndex).toHaveLength(2);
        expect(result.materialCatalog).toMatchObject([
          { slot: "blue", releaseId: "inherited", sequence: 7 },
        ]);
        expect(result.articleCatalog).toMatchObject([
          { slot: "blue", releaseId: "inherited", sequence: 7 },
        ]);
        expect(result.articleCategories).toHaveLength(1);
        expect(result.articleBuckets).toMatchObject([
          { articleCount: 1, categoryCount: 1 },
        ]);
      })
  );

  it.effect(
    "rejects missing search or catalog members and mismatched partition counts",
    () =>
      Effect.gen(function* () {
        for (const table of [
          "contentIndex",
          "articleCatalog",
          "articleCategories",
          "articleBuckets",
          "materialCatalog",
          "materialBuckets",
        ] as const) {
          const { source } = yield* catalogSource();
          source.set(table, []);
          expect(
            yield* projectActiveRuntime(source).pipe(Effect.flip)
          ).toMatchObject({ _tag: "ContentSnapshotError" });
        }
      })
  );

  it.effect(
    "rejects category representative drift and stale catalog provenance",
    () =>
      Effect.gen(function* () {
        for (const table of [
          "articleCategories",
          "articleCatalog",
          "materialCatalog",
        ] as const) {
          const { source } = yield* catalogSource();
          source.set(
            table,
            (source.get(table) ?? []).map((row) => ({
              ...row,
              releaseId: "foreign-release",
            }))
          );
          expect(
            yield* projectActiveRuntime(source).pipe(Effect.flip)
          ).toMatchObject({ _tag: "ContentSnapshotError" });
        }
      })
  );

  it.effect(
    "rejects partition duplicates, unrelated partitions, and catalog metadata drift",
    () =>
      Effect.gen(function* () {
        for (const mutation of [
          "duplicate-bucket",
          "orphan-bucket",
          "material-source",
          "article-metadata",
        ] as const) {
          const { source } = yield* catalogSource();
          if (mutation === "duplicate-bucket") {
            const buckets = source.get("materialBuckets") ?? [];
            source.set("materialBuckets", [...buckets, ...buckets]);
          } else if (mutation === "orphan-bucket") {
            source.set(
              "materialBuckets",
              (source.get("materialBuckets") ?? []).map((row) => ({
                ...row,
                bucket: "unrelated",
              }))
            );
          } else if (mutation === "material-source") {
            source.set(
              "materialCatalog",
              (source.get("materialCatalog") ?? []).map((row) => ({
                ...row,
                sourcePath: "unrelated/source.mdx",
              }))
            );
          } else {
            source.set(
              "articleCatalog",
              (source.get("articleCatalog") ?? []).map((row) => ({
                ...row,
                categoryTitle: "changed",
              }))
            );
          }
          expect(
            yield* projectActiveRuntime(source).pipe(Effect.flip)
          ).toMatchObject({ _tag: "ContentSnapshotError" });
        }
      })
  );

  it.effect(
    "rejects duplicate active catalog identities and empty material partitions",
    () =>
      Effect.gen(function* () {
        const duplicated = yield* catalogSource();
        const rows = duplicated.source.get("contentIndex") ?? [];
        duplicated.source.set("contentIndex", [...rows, ...rows]);
        expect(
          yield* projectActiveRuntime(duplicated.source).pipe(Effect.flip)
        ).toMatchObject({ _tag: "ContentSnapshotError" });
        const empty = yield* catalogSource();
        empty.source.set(
          "materialBuckets",
          (empty.source.get("materialBuckets") ?? []).map((row) => ({
            ...row,
            count: 0,
          }))
        );
        expect(
          yield* projectActiveRuntime(empty.source).pipe(Effect.flip)
        ).toMatchObject({
          message:
            "Signed runtime contains an empty or oversized catalog partition.",
        });
      })
  );
});
