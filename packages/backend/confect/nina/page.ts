import { getNakafaContent } from "@repo/backend/agent/content";
import { NINA_BUDGET } from "@repo/backend/confect/nina/budget";
import { formatRead } from "@repo/backend/confect/nina/nakafa/sections";
import { NakafaAgentContentRefInputSchema } from "@repo/contents/agent/schema/read";
import { Array as Arr, Effect, Option } from "effect";

const UNAVAILABLE = Arr.join(
  [
    "# Current Page",
    "",
    "The signed current page could not be read for this turn. Retrieve it with Nakafa before relying on its content.",
  ],
  "\n"
);

/**
 * Reads the signed current page once per turn into a bounded prompt block.
 * The page sits in Nina's stable prompt context instead of a forced tool call,
 * and an unreadable page becomes a visible limitation rather than a failure.
 */
export const readPageContext = Effect.fn("nina.page.read")(function* (
  url: string
) {
  const content = yield* getNakafaContent(
    NakafaAgentContentRefInputSchema.make(url)
  ).pipe(
    Effect.catchTag("NakafaAgentDataReadError", (error) =>
      Effect.logWarning("Nina current page unavailable", {
        reason: error.message,
      }).pipe(Effect.as(Option.none()))
    )
  );
  if (Option.isNone(content)) {
    return UNAVAILABLE;
  }
  return Arr.join(
    [
      "# Current Page",
      "",
      "The learner is viewing this signed Nakafa page. Answer from it when it covers the question. For another listed section, ask Nakafa to read that Content ID at that section.",
      "",
      formatRead(content.value, { budget: NINA_BUDGET.page }),
    ],
    "\n"
  );
});
