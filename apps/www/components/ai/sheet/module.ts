import { Data, Effect } from "effect";

/** Expected failure while warming one of Nina's deferred sheet chunks. */
class AiSheetPreloadError extends Data.TaggedError("AiSheetPreloadError")<{
  cause: unknown;
  message: string;
}> {}

/** Loads the new-chat body: the composer and its suggestions. */
export function loadSheetNew() {
  return import("@/components/ai/sheet/new");
}

/** Loads the conversation body: the transcript, Markdown, math and streaming. */
export function loadSheetConversation() {
  return import("@/components/ai/sheet/conversation");
}

/**
 * Warms Nina's sheet body before the learner opens it, without leaking a
 * failed preload to the UI. The frame is part of the app shell and needs no
 * preload. The conversation chunk is warmed only when a chat is about to show.
 */
export const preloadAiSheet = Effect.fn("www.ai.preloadSheet")(
  (conversation: boolean) =>
    Effect.tryPromise({
      catch: (cause) =>
        new AiSheetPreloadError({
          cause,
          message: "Failed to preload the Nina sheet.",
        }),
      try: () =>
        Promise.all([
          loadSheetNew(),
          conversation ? loadSheetConversation() : undefined,
        ]),
    }).pipe(Effect.ignore)
);
