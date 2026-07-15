import {
  convertPromptInputFiles,
  type PromptInputAttachmentConversionError,
  type PromptInputFile,
} from "@repo/design-system/lib/prompt-input/files";
import type { FileUIPart } from "ai";
import { Effect, Schema } from "effect";

/** A submitted prompt and its browser-ready attachments. */
export interface PromptInputMessage {
  files?: FileUIPart[];
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
  | PromptInputAttachmentConversionError
  | PromptInputCompletionError
  | PromptInputSubmitError;

interface SubmitPromptInputOptions<TEvent> {
  event: TEvent;
  files: readonly PromptInputFile[];
  onSubmit: (
    message: PromptInputMessage,
    event: TEvent
  ) => void | Promise<void>;
  onSuccess: () => void;
  text: string;
}

/** Converts attachments, invokes the consumer, and applies success state once. */
export const submitPromptInput = Effect.fn("designSystem.promptInput.submit")(
  function* <TEvent>({
    event,
    files,
    onSubmit,
    onSuccess,
    text,
  }: SubmitPromptInputOptions<TEvent>) {
    const convertedFiles = yield* convertPromptInputFiles(files);
    const pendingSubmit = yield* Effect.try({
      try: () => onSubmit({ text, files: convertedFiles }, event),
      catch: (cause) => new PromptInputSubmitError({ cause }),
    });

    if (pendingSubmit instanceof Promise) {
      yield* Effect.tryPromise({
        try: () => pendingSubmit,
        catch: (cause) => new PromptInputSubmitError({ cause }),
      });
    }

    yield* Effect.try({
      try: onSuccess,
      catch: (cause) => new PromptInputCompletionError({ cause }),
    });
  }
);
