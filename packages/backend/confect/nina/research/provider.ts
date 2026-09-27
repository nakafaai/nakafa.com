import FirecrawlApp from "@mendable/firecrawl-js";
import { Config, Effect, Redacted, Schema } from "effect";

export class ResearchProviderError extends Schema.TaggedError<ResearchProviderError>()(
  "ResearchProviderError",
  { message: Schema.String }
) {}

/** Resolve research credentials inside the action that uses the provider. */
export const readFirecrawlApp = Effect.fn("research.provider")(function* () {
  const key = yield* Config.Redacted("FIRECRAWL_API_KEY").pipe(
    Effect.mapError(
      () =>
        new ResearchProviderError({
          message: "Web research is not configured.",
        })
    )
  );
  const apiKey = Redacted.value(key);
  if (!apiKey.trim()) {
    return yield* new ResearchProviderError({
      message: "Web research is not configured.",
    });
  }
  return yield* Effect.try({
    try: () => new FirecrawlApp({ apiKey }),
    catch: () =>
      new ResearchProviderError({ message: "Web research is not configured." }),
  });
});
