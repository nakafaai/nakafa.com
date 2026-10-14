import { RegisteredFunction } from "@confect/server";
import { expect, it } from "@effect/vitest";
import { searchNakafaContent } from "@repo/backend/agent/search";
import schema from "@repo/backend/confect/_generated/schema";
import { createConvexTestWithBetterAuth } from "@repo/backend/confect/test.helpers";
import { NAKAFA_AGENT_MAX_QUERY_LENGTH } from "@repo/contents/agent/search";
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

it("refuses a query of one character more than the limit, before the read model", async () => {
  await createConvexTestWithBetterAuth().action(async (ctx) => {
    const runQuery = vi.spyOn(ctx, "runQuery").mockResolvedValue(false);
    const search = (length: number) =>
      searchNakafaContent({
        locale: "en",
        queries: ["a".repeat(length)],
      }).pipe(Effect.flip);
    const [atLimit, tooLong] = await Effect.runPromise(
      Effect.all(
        [
          search(NAKAFA_AGENT_MAX_QUERY_LENGTH),
          search(NAKAFA_AGENT_MAX_QUERY_LENGTH + 1),
        ],
        { concurrency: 1 }
      ).pipe(Effect.provide(RegisteredFunction.actionLayer(schema, ctx)))
    );

    // A query of the most characters reaches the read model, which the mock
    // answers with data that is not a result.
    expect(atLimit).toMatchObject({ _tag: "NakafaAgentDataReadError" });
    // One more is invalid input for a caller of the MCP tool or the public API.
    expect(tooLong).toMatchObject({
      _tag: "NakafaAgentInputError",
      message: "Invalid Nakafa content search options.",
    });
    // Only the first of the two reached the read model.
    expect(runQuery).toHaveBeenCalledTimes(1);
  });
});
