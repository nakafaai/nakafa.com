import { RegisteredFunction } from "@confect/server";
import { expect, it } from "@effect/vitest";
import { searchNakafaContent } from "@repo/backend/agent/search";
import schema from "@repo/backend/confect/_generated/schema";
import { createConvexTestWithBetterAuth } from "@repo/backend/confect/test.helpers";
import { Effect } from "effect";

it("rejects a malformed search response instead of presenting unverified results", async () => {
  await createConvexTestWithBetterAuth().action(async (ctx) => {
    vi.spyOn(ctx, "runQuery").mockResolvedValueOnce(false);
    const error = await Effect.runPromise(
      searchNakafaContent({ queries: ["algebra"], locale: "en" }).pipe(
        Effect.flip,
        Effect.provide(RegisteredFunction.actionLayer(schema, ctx))
      )
    );
    expect(error).toMatchObject({
      _tag: "NakafaAgentDataReadError",
      message: "Unable to search Nakafa content.",
    });
  });
});
