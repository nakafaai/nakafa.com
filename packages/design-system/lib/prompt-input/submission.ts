import { PromptInputFileSchema } from "@repo/design-system/lib/prompt-input/files";
import { Effect, Schema } from "effect";

const PromptInputMessageSchema = Schema.Struct({
  files: Schema.optionalKey(Schema.Array(PromptInputFileSchema)),
  text: Schema.optionalKey(Schema.String),
});
/** A submitted prompt and its browser-ready attachments. */
export type PromptInputMessage = typeof PromptInputMessageSchema.Type;

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

/** Prompt text and original files that one submission passes on. */
const PromptInputSubmissionSchema = Schema.Struct({
  files: Schema.Array(PromptInputFileSchema),
  text: Schema.String,
});

/** Admits one submitted prompt; a false result keeps the draft in place. */
type PromptInputSubmitHandler<TEvent> = (
  message: PromptInputMessage,
  event: TEvent
) => boolean | Promise<boolean>;

/** Applies the local success state after the consumer admits a prompt. */
type PromptInputSuccessHandler = () => void;

/** Passes original files to the consumer and applies success state once. */
export const submitPromptInput = Effect.fn("designSystem.promptInput.submit")(
  function* <TEvent>({
    event,
    files,
    onSubmit,
    onSuccess,
    text,
  }: typeof PromptInputSubmissionSchema.Type & {
    event: TEvent;
    onSubmit: PromptInputSubmitHandler<TEvent>;
    onSuccess: PromptInputSuccessHandler;
  }) {
    const accepted = yield* Effect.tryPromise({
      try: () => Promise.resolve(onSubmit({ text, files: [...files] }, event)),
      catch: (cause) => PromptInputSubmitError.make({ cause }),
    });

    if (accepted === false) {
      return;
    }
    yield* Effect.try({
      try: onSuccess,
      catch: (cause) => PromptInputCompletionError.make({ cause }),
    });
  }
);
