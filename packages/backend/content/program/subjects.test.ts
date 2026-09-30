import { RegisteredConvexFunction } from "@confect/server";
import { assert, describe, expect, it } from "@effect/vitest";
import {
  CorpusSourcePathSchema,
  PublicPathSchema,
} from "@nakafa/aksara-contracts/ids";
import {
  ACTIVE_APP_LOCALES,
  ActiveAppLocaleSchema,
} from "@nakafa/aksara-contracts/locale";
import { MaterialDomainSchema } from "@nakafa/aksara-contracts/material/domain";
import { CurriculumRouteSchema } from "@nakafa/aksara-contracts/program/curriculum";
import { LearningProgramSchema } from "@nakafa/aksara-contracts/program/spec";
import confectSchema from "@repo/backend/confect/_generated/schema";
import { decodeSnapshotRowJson } from "@repo/backend/confect/contentRelease/parse";
import {
  PROGRAM_FEATURED_SUBJECT_LIMIT,
  PROGRAM_SUBJECT_LIMIT,
} from "@repo/backend/confect/contentRelease/program/limits";
import { convexModules } from "@repo/backend/confect/test.setup";
import { api } from "@repo/backend/convex/_generated/api";
import schema from "@repo/backend/convex/schema";
import {
  activateProgramSnapshot,
  makeProgramSnapshotData,
  makeTechnicalProgram,
} from "@repo/backend/test/program/snapshot";
import { convexTest } from "convex-test";
import { Effect } from "effect";

describe("bounded public program subjects", () => {
  const appLocale = ActiveAppLocaleSchema.make("en");
  const program = LearningProgramSchema.make({
    ...makeTechnicalProgram(1),
    navigation: {
      model: "curriculum-tree",
      levels: ["track", "class", "subject"],
    },
  });
  const root = "curriculum/technical-program-1";

  /**
   * One public or hidden curriculum route under the technical program. The
   * public path ends in the node key unless a translated slug replaces it.
   */
  function route(input: {
    domain?: string;
    level: "class" | "subject";
    nodeKey: string;
    order: number;
    parentPath: string;
    sitemap?: boolean;
    slug?: string;
  }) {
    return CurriculumRouteSchema.make({
      appLocale,
      iconKey: "mathematics",
      kind: "curriculum-context",
      level: input.level,
      ...(input.domain === undefined
        ? {}
        : { materialDomain: MaterialDomainSchema.make(input.domain) }),
      nodeKey: input.nodeKey,
      order: input.order,
      parentPath: PublicPathSchema.make(input.parentPath),
      programKey: program.key,
      publicPath: PublicPathSchema.make(
        `${input.parentPath}/${input.slug ?? input.nodeKey}`
      ),
      sitemap: input.sitemap ?? true,
      sourcePath: CorpusSourcePathSchema.make(
        "packages/corpus/curriculum/technical-program-1"
      ),
      title: `Technical ${input.nodeKey}`,
    });
  }

  /** Activates one program snapshot holding the given routes in convex-test. */
  const activate = Effect.fn("subjectsTest.activate")(function* (
    routes: readonly ReturnType<typeof route>[]
  ) {
    const runtimeServices = yield* Effect.context<never>();
    const data = yield* makeProgramSnapshotData(
      [program],
      ACTIVE_APP_LOCALES,
      routes
    );
    const runtime = convexTest(schema, convexModules);
    yield* Effect.promise(() =>
      runtime.mutation((ctx) =>
        Effect.runPromiseWith(runtimeServices)(
          activateProgramSnapshot(data).pipe(
            Effect.provide(
              RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
            )
          )
        )
      )
    );
    return { data, runtime };
  });

  it.effect(
    "features each material domain once, in authored order, breaks ties by key, and rejects damaged signed rows",
    () =>
      Effect.gen(function* () {
        // The second class is authored first even though its path sorts last.
        const first = `${root}/class-b`;
        const second = `${root}/class-a`;
        const { data, runtime } = yield* activate([
          route({
            level: "class",
            nodeKey: "class-b",
            order: 10,
            parentPath: root,
          }),
          route({
            level: "class",
            nodeKey: "class-a",
            order: 20,
            parentPath: root,
          }),
          route({
            domain: "art",
            level: "subject",
            nodeKey: "b-art",
            order: 5,
            parentPath: first,
            sitemap: false,
          }),
          route({
            domain: "chemistry",
            level: "subject",
            nodeKey: "b-chemistry",
            order: 10,
            parentPath: first,
          }),
          route({
            level: "subject",
            nodeKey: "b-civics",
            order: 15,
            parentPath: first,
          }),
          route({
            domain: "mathematics",
            level: "subject",
            nodeKey: "b-mathematics",
            order: 20,
            parentPath: first,
          }),
          route({
            domain: "mathematics",
            level: "subject",
            nodeKey: "a-mathematics",
            order: 10,
            parentPath: second,
          }),
          // Physics and biology share an authored position. Their translated
          // paths put physics first, but the node keys put biology first.
          route({
            domain: "physics",
            level: "subject",
            nodeKey: "a-physics",
            order: 20,
            parentPath: second,
            slug: "fisika",
          }),
          route({
            domain: "biology",
            level: "subject",
            nodeKey: "a-biology",
            order: 20,
            parentPath: second,
            slug: "hayati",
          }),
          route({
            domain: "informatics",
            level: "subject",
            nodeKey: "a-informatics",
            order: 40,
            parentPath: second,
          }),
        ]);
        const result = yield* Effect.promise(() =>
          runtime.query(api.contentRelease.program.subjects, {
            appLocale,
          })
        );
        expect(result.managed).toBe(true);
        const decoded = yield* Effect.forEach(
          result.routeJson,
          decodeSnapshotRowJson
        );
        const featured = decoded.map((entry) => {
          assert(
            entry.family === "program" && entry.record.kind === "curriculum"
          );
          return entry.record.row;
        });
        expect(featured).toHaveLength(PROGRAM_FEATURED_SUBJECT_LIMIT);
        expect(featured.map(({ publicPath }) => publicPath)).toEqual([
          `${first}/b-chemistry`,
          `${first}/b-mathematics`,
          `${second}/hayati`,
          `${second}/fisika`,
        ]);
        for (const row of featured) {
          expect(row).toMatchObject({
            appLocale,
            level: "subject",
            sitemap: true,
          });
        }
        expect(
          yield* Effect.promise(() =>
            runtime.query(api.contentRelease.program.subjects, {
              appLocale: "id",
            })
          )
        ).toEqual({
          managed: true,
          routeJson: [],
        });
        yield* Effect.promise(() =>
          runtime.mutation(async (ctx) => {
            const row = await ctx.db
              .query("curriculumRoutes")
              .withIndex("by_snapshotId_and_appLocale_and_path", (index) =>
                index
                  .eq("snapshotId", data.snapshotId)
                  .eq("appLocale", appLocale)
                  .eq("path", `${first}/b-chemistry`)
              )
              .unique();
            assert.isNotNull(row);
            await ctx.db.patch("curriculumRoutes", row._id, {
              rowHash: `sha256:${"f".repeat(64)}`,
            });
          })
        );
        yield* Effect.promise(() =>
          expect(
            runtime.query(api.contentRelease.program.subjects, {
              appLocale,
            })
          ).rejects.toThrow("CONTENT_RELEASE_INTEGRITY")
        );
      })
  );

  it.effect(
    "rejects a locale that publishes more subjects than one read covers",
    () =>
      Effect.gen(function* () {
        const { data, runtime } = yield* activate([]);
        // The bound is enforced before any row is authenticated.
        yield* Effect.promise(() =>
          runtime.mutation(async (ctx) => {
            for (let index = 0; index <= PROGRAM_SUBJECT_LIMIT; index += 1) {
              await ctx.db.insert("curriculumRoutes", {
                appLocale,
                bucket: "000",
                index: 1000 + index,
                level: "subject",
                nodeKey: `overflow-${index}`,
                order: index,
                parentPath: root,
                path: `${root}/overflow-${index}`,
                programKey: program.key,
                rowHash: "not-read",
                rowJson: "not-read",
                snapshotId: data.snapshotId,
                sourcePath: "packages/corpus/curriculum/technical-program-1",
              });
            }
          })
        );
        yield* Effect.promise(() =>
          expect(
            runtime.query(api.contentRelease.program.subjects, {
              appLocale,
            })
          ).rejects.toThrow("CONTENT_RELEASE_LIMIT")
        );
      })
  );

  it("returns explicit unavailability before an active program publication", async () => {
    const runtime = convexTest(schema, convexModules);
    await expect(
      runtime.query(api.contentRelease.program.subjects, {
        appLocale: "en",
      })
    ).resolves.toEqual({
      managed: false,
      routeJson: [],
    });
  });
});
