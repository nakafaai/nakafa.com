import type { PromptInputFile } from "@repo/design-system/lib/prompt-input/files";
import { Effect, Schema } from "effect";

/** A submitted prompt and its browser-ready attachments. */
export interface PromptInputMessage {
  files?: PromptInputFile[];
  text?: string;
}

/** Expected failure raised by the consumer-owned prompt submit callback. */
export class PromptInputSubmitError extends Schema.TaggedError<PromptInputSubmitError>()(
  "PromptInputSubmitError",
  { cause: Schema.Unknown }
) {}

/** Expected failure raised while applying local success state after submission. */
export class PromptInputCompletionError extends Schema.TaggedError<PromptInputCompletionError>()(
  "PromptInputCompletionError",
  { cause: Schema.Unknown }
) {}

/** Every expected failure produced by a prompt submission. */
export type PromptInputError =
  | PromptInputCompletionError
  | PromptInputSubmitError;

interface SubmitPromptInputOptions<TEvent> {
  event: TEvent;
  files: readonly PromptInputFile[];
  onSubmit: (
    message: PromptInputMessage,
    event: TEvent
  ) => boolean | Promise<boolean>;
  onSuccess: () => void;
  text: string;
}

/** Passes original files to the consumer and applies success state once. */
export const submitPromptInput = Effect.fn("designSystem.promptInput.submit")(
  function* <TEvent>({
    event,
    files,
    onSubmit,
    onSuccess,
    text,
  }: SubmitPromptInputOptions<TEvent>) {
    const accepted = yield* Effect.tryPromise({
      try: () => Promise.resolve(onSubmit({ text, files: [...files] }, event)),
      catch: (cause) => new PromptInputSubmitError({ cause }),
    });

    if (accepted === false) {
      return;
    }
    yield* Effect.try({
      try: onSuccess,
      catch: (cause) => new PromptInputCompletionError({ cause }),
    });
  }
);
