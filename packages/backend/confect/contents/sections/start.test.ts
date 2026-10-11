import { RegisteredFunction } from "@confect/server";
import { beforeEach, describe, expect, it } from "@effect/vitest";
import schema from "@repo/backend/confect/_generated/schema";
import { startSectionBuild } from "@repo/backend/confect/contents/sections/start";
import { createConvexTestWithBetterAuth } from "@repo/backend/confect/test.helpers";
import { Effect } from "effect";

beforeEach(() => vi.useFakeTimers());

describe("section build start", () => {
  it("schedules the first build step of the release at once", async () => {
    const t = createConvexTestWithBetterAuth();
    await t.action((ctx) =>
      Effect.runPromise(
        startSectionBuild("release-1").pipe(
          Effect.provide(RegisteredFunction.actionLayer(schema, ctx))
        )
      )
    );
    const jobs = await t.run((ctx) =>
      ctx.db.system.query("_scheduled_functions").collect()
    );
    expect(jobs).toMatchObject([
      {
        args: [{ releaseId: "release-1" }],
        name: "contents/sections/build:run",
        state: { kind: "pending" },
      },
    ]);
  });
});
