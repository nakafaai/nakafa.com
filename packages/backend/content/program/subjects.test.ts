import { assert, describe, expect, it } from "@effect/vitest";
import {
  CorpusSourcePathSchema,
  PublicPathSchema,
} from "@nakafa/aksara-contracts/ids";
import {
  ACTIVE_APP_LOCALES,
  ActiveAppLocaleSchema,
} from "@nakafa/aksara-contracts/locale";
import { CurriculumRouteSchema } from "@nakafa/aksara-contracts/program/curriculum";
import { LearningProgramSchema } from "@nakafa/aksara-contracts/program/spec";
import { api } from "@repo/backend/convex/_generated/api";
import { decodeSnapshotRowJson } from "@repo/backend/convex/contentRelease/parse";
import { PROGRAM_FEATURED_SUBJECT_LIMIT } from "@repo/backend/convex/contentRelease/program/limits";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  activateProgramSnapshot,
  makeProgramSnapshotData,
  makeTechnicalProgram,
} from "@repo/backend/test/program/snapshot";
import { convexTest } from "convex-test";
import { Effect } from "effect";

describe("bounded public program subjects", () => {
  it.effect(
    "reads four public subjects with native indexes and rejects damaged signed rows",
    () =>
      Effect.gen(function* () {
        const appLocale = ActiveAppLocaleSchema.make("en");
        const program = LearningProgramSchema.make({
          ...makeTechnicalProgram(1),
          navigation: {
            model: "curriculum-tree",
            levels: ["track", "subject"],
          },
        });
        const subjects = Array.from({ length: 9 }, (_, index) =>
          CurriculumRouteSchema.make({
            appLocale,
            iconKey: "mathematics",
            kind: "curriculum-context",
            level: "subject",
            nodeKey: `subject-${index}`,
            order: index,
            parentPath: PublicPathSchema.make("curriculum/technical-program-1"),
            programKey: program.key,
            publicPath: PublicPathSchema.make(
              `curriculum/technical-program-1/subject-${index}`
            ),
            sitemap: index > 0,
            sourcePath: CorpusSourcePathSchema.make(
              "packages/corpus/curriculum/technical-program-1"
            ),
            title: `Technical subject ${index}`,
          })
        );
        const data = yield* makeProgramSnapshotData(
          [program],
          ACTIVE_APP_LOCALES,
          subjects
        );
        const runtime = convexTest(schema, convexModules);
        yield* Effect.promise(() => activateProgramSnapshot(runtime, data));
        const result = yield* Effect.promise(() =>
          runtime.query(api.contentRelease.program.subjects, { appLocale })
        );
        expect(result.managed).toBe(true);
        expect(result.routeJson).toHaveLength(PROGRAM_FEATURED_SUBJECT_LIMIT);
        const decoded = yield* Effect.forEach(
          result.routeJson,
          decodeSnapshotRowJson
        );
        for (const entry of decoded) {
          assert(
            entry.family === "program" && entry.record.kind === "curriculum"
          );
          expect(entry.record.row).toMatchObject({
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
        ).toEqual({ managed: true, routeJson: [] });
        const first = decoded[0];
        assert(
          first?.family === "program" && first.record.kind === "curriculum"
        );
        const publicPath = first.record.row.publicPath;
        yield* Effect.promise(() =>
          runtime.mutation(async (ctx) => {
            const row = await ctx.db
              .query("curriculumRoutes")
              .withIndex("by_snapshotId_and_appLocale_and_path", (index) =>
                index
                  .eq("snapshotId", data.snapshotId)
                  .eq("appLocale", appLocale)
                  .eq("path", publicPath)
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
            runtime.query(api.contentRelease.program.subjects, { appLocale })
          ).rejects.toThrow("CONTENT_RELEASE_INTEGRITY")
        );
      })
  );

  it("returns explicit unavailability before an active program publication", async () => {
    const runtime = convexTest(schema, convexModules);
    await expect(
      runtime.query(api.contentRelease.program.subjects, { appLocale: "en" })
    ).resolves.toEqual({ managed: false, routeJson: [] });
  });
});
