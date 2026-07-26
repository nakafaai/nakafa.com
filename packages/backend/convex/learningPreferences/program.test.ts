import { listCurriculumPrograms } from "@repo/backend/convex/learningPreferences/program";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  activateProgramSnapshot,
  makeProgramSnapshotData,
  makeTechnicalProgram,
} from "@repo/backend/test/program-snapshot";
import { convexTest } from "convex-test";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

describe("learningPreferences/program", () => {
  it("filters program kinds before enforcing the curriculum preference limit", async () => {
    const unrelated = Array.from({ length: 51 }, (_, index) =>
      makeTechnicalProgram(index + 1, "admission-exam")
    );
    const curricula = [makeTechnicalProgram(52), makeTechnicalProgram(53)];
    const data = await Effect.runPromise(
      makeProgramSnapshotData([...unrelated, ...curricula])
    );
    const t = convexTest(schema, convexModules);
    await activateProgramSnapshot(t, data, 16);

    await expect(
      t.query((ctx) => runConvexProgram(listCurriculumPrograms(ctx, "en")))
    ).resolves.toMatchObject([
      { key: "technical-program-52" },
      { key: "technical-program-53" },
    ]);
  });

  it("rejects a published preference list beyond its bounded UI contract", async () => {
    const programs = Array.from({ length: 51 }, (_, index) =>
      makeTechnicalProgram(index + 1)
    );
    const data = await Effect.runPromise(makeProgramSnapshotData(programs));
    const t = convexTest(schema, convexModules);
    await activateProgramSnapshot(t, data, 16);

    await expect(
      t.query((ctx) => runConvexProgram(listCurriculumPrograms(ctx, "en")))
    ).rejects.toThrow("Curriculum program catalog exceeds 50 rows.");
  });

  it("rejects a source preference list beyond its bounded UI contract", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      for (let index = 1; index <= 51; index += 1) {
        await ctx.db.insert("learningPrograms", {
          defaultCoverageStatus: "planned",
          displayOrder: index,
          iconKey: "school",
          key: `technical-program-${index}`,
          kind: "school-curriculum",
          navigation: { levels: ["track"], model: "curriculum-tree" },
          providerKind: "nakafa",
          providerName: "Nakafa protocol tests",
          syncedAt: index,
          translations: {
            en: {
              publicSlug: `technical-program-${index}`,
              title: `Technical Program ${index}`,
            },
            id: {
              publicSlug: `program-teknis-${index}`,
              title: `Program Teknis ${index}`,
            },
          },
          updatedAt: index,
          versionLabel: "Technical protocol version",
        });
      }
    });

    await expect(
      t.query((ctx) => runConvexProgram(listCurriculumPrograms(ctx, "en")))
    ).rejects.toThrow("Curriculum program catalog exceeds 50 rows.");
  });
});
