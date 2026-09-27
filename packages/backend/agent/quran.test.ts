import { RegisteredFunction } from "@confect/server";
import { expect, it } from "@effect/vitest";
import { getNakafaQuranReference } from "@repo/backend/agent/quran";
import schema from "@repo/backend/confect/_generated/schema";
import { createConvexTestWithBetterAuth } from "@repo/backend/confect/test.helpers";
import {
  makeQuranAttribution,
  makeQuranSurah,
} from "@repo/backend/test/quran/rows";
import { activateQuranSnapshot } from "@repo/backend/test/quran/snapshot";
import { getFunctionName } from "convex/server";
import { Effect } from "effect";

it.each(["surahs", "passage"])(
  "rejects malformed Quran %s data before interpretation",
  async (query) => {
    const test = createConvexTestWithBetterAuth();
    await test.mutation((ctx) =>
      activateQuranSnapshot(ctx, [
        makeQuranAttribution(),
        ...Array.from({ length: 114 }, (_, index) => makeQuranSurah(index + 1)),
      ])
    );
    await test.action(async (ctx) => {
      const runQuery = ctx.runQuery.bind(ctx);
      vi.spyOn(ctx, "runQuery").mockImplementation((reference, args = {}) =>
        getFunctionName(reference) === `contentRelease/quran:${query}`
          ? Promise.resolve(false)
          : runQuery(reference, args)
      );
      const error = await Effect.runPromise(
        getNakafaQuranReference({ locale: "en", surah: 1, from_verse: 1 }).pipe(
          Effect.flip,
          Effect.provide(RegisteredFunction.actionLayer(schema, ctx))
        )
      );
      expect(error).toMatchObject({
        _tag: "NakafaAgentDataReadError",
        message:
          query === "surahs"
            ? "Unable to read the signed Nakafa Quran catalog."
            : "Unable to read the signed Nakafa Quran reference.",
      });
    });
  }
);
