import { Data, Effect } from "effect";

/** Expected failure while warming Nina's deferred sheet bundle. */
class AiSheetPreloadError extends Data.TaggedError("AiSheetPreloadError")<{
  cause: unknown;
  message: string;
}> {}

/** Loads the full Nina sheet at the Next.js dynamic-component boundary. */
export function loadAiSheetModule() {
  return import("@/components/ai/sheet");
}

/** Warms Nina's sheet bundle without leaking a failed preload to the UI. */
export const preloadAiSheet = Effect.fn("www.ai.preloadSheet")(() =>
  Effect.tryPromise({
    catch: (cause) =>
      new AiSheetPreloadError({
        cause,
        message: "Failed to preload the Nina sheet.",
      }),
    try: loadAiSheetModule,
  }).pipe(Effect.ignore)
);
