import { Data, Effect } from "effect";

/** Expected failure while loading Nina's deferred chat runtime. */
class ChatRuntimeLoadError extends Data.TaggedError("ChatRuntimeLoadError")<{
  cause: unknown;
  message: string;
}> {}

/** Loads the chat runtime only when a learner submits their first message. */
export const loadChatRuntime = Effect.fn("www.ai.loadChatRuntime")(() =>
  Effect.tryPromise({
    catch: (cause) =>
      new ChatRuntimeLoadError({
        cause,
        message: "Failed to load the Nina chat runtime.",
      }),
    try: () => import("@/components/ai/helpers/runtime"),
  })
);
