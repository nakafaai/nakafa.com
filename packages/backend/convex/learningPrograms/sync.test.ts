import { api, internal } from "@repo/backend/convex/_generated/api";
import { getLearningProgramCatalogInputs } from "@repo/backend/convex/learningPrograms/catalog";
import {
  seedLearningProgramCatalog,
  TEST_NOW,
} from "@repo/backend/convex/learningPrograms/testing";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import { ConvexError } from "convex/values";
import { assert, describe, expect, it } from "vitest";

describe("learningPrograms/sync", () => {
  it("syncs selectable catalog rows and bounded source rows", async () => {
    const t = createConvexTestWithBetterAuth();
    const result = await seedLearningProgramCatalog(t);
    const programs = await t.query(
      api.learningPrograms.queries.listSelectablePrograms,
      {}
    );
    const sourceCount = await t.query(async (ctx) => {
      const program = await ctx.db
        .query("learningPrograms")
        .withIndex("by_key", (q) => q.eq("key", "tka"))
        .unique();
      assert(program, "Expected synced TKA program.");
      const sources = await ctx.db
        .query("learningProgramSources")
        .withIndex("by_programId", (q) => q.eq("programId", program._id))
        .take(10);
      return sources.length;
    });

    expect(result).toEqual({ created: 6, skipped: 0, updated: 0 });
    expect(programs.map((program) => program.key)).toEqual(["merdeka", "snbt"]);
    expect(programs.find((program) => program.key === "merdeka")).toMatchObject(
      {
        navigation: {
          levels: ["stage", "class", "subject", "topic"],
          model: "curriculum-tree",
        },
      }
    );
    expect(sourceCount).toBe(2);
  });

  it("rejects empty catalog batches before reconciliation", async () => {
    const t = createConvexTestWithBetterAuth();

    await expect(
      t.mutation(internal.learningPrograms.sync.syncLearningPrograms, {
        programs: [],
        syncedAt: TEST_NOW,
      })
    ).rejects.toThrow("LEARNING_PROGRAM_CATALOG_EMPTY");
  });

  it("rejects source lists beyond the bounded replacement contract", async () => {
    const t = createConvexTestWithBetterAuth();
    const [program] = getLearningProgramCatalogInputs();
    const sources = Array.from({ length: 21 }, (_, index) => ({
      label: `Source ${index}`,
      retrievedAt: "2026-06-14",
      type: "nakafa-editorial",
      url: `https://nakafa.com/source-${index}`,
    })) satisfies typeof program.sources;

    await expect(
      t.mutation(internal.learningPrograms.sync.syncLearningPrograms, {
        programs: [{ ...program, sources }],
        syncedAt: TEST_NOW,
      })
    ).rejects.toThrow(ConvexError);
  });

  it("rejects invalid registry date strings before writes", async () => {
    const t = createConvexTestWithBetterAuth();
    const [program] = getLearningProgramCatalogInputs();

    await expect(
      t.mutation(internal.learningPrograms.sync.syncLearningPrograms, {
        programs: [
          {
            ...program,
            sources: [
              {
                ...program.sources[0],
                retrievedAt: "not-a-date",
              },
            ],
          },
        ],
        syncedAt: TEST_NOW,
      })
    ).rejects.toThrow("LEARNING_PROGRAM_CATALOG_INVALID");
  });
});
