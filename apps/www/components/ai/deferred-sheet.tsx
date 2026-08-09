"use client";

import { Data, Effect } from "effect";
import dynamic from "next/dynamic";
import { useAi } from "@/components/ai/context/use-ai";

/** Expected failure while warming Nina's deferred sheet bundle. */
class AiSheetPreloadError extends Data.TaggedError("AiSheetPreloadError")<{
  cause: unknown;
  message: string;
}> {}

/** Loads the full Nina sheet only after a learner signals intent. */
function loadAiSheetModule() {
  return import("@/components/ai/sheet");
}

const LazyAiSheet = dynamic(
  () => loadAiSheetModule().then((module) => module.AiSheet),
  {
    loading: () => null,
    ssr: false,
  }
);

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

/** Mounts Nina once requested, then preserves its state across later closes. */
export function DeferredAiSheet() {
  const activated = useAi((state) => state.sheetActivated);

  if (!activated) {
    return null;
  }

  return <LazyAiSheet />;
}
