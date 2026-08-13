import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { makeFunctionReference, type PaginationOptions } from "convex/server";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

const scheduledPage = makeFunctionReference<
  "query",
  { paginationOpts: PaginationOptions },
  { activeNames: string[]; cursor: string; done: boolean }
>("contentRelease/cutover/audioComponent:scheduledPage");
const oldAudioAction = makeFunctionReference<"action", Record<string, never>>(
  "audioStudies/actions:generateScript"
);

describe("contentRelease/cutover/audioComponent", () => {
  it("finds active references to deleted audio functions", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await ctx.scheduler.runAfter(60_000, oldAudioAction, {});
    });

    await expect(
      t.query(scheduledPage, {
        paginationOpts: { cursor: null, numItems: 128 },
      })
    ).resolves.toMatchObject({
      activeNames: ["audioStudies/actions:generateScript"],
      done: true,
    });
  });
});
