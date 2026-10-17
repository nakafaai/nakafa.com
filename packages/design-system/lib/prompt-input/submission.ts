import {
  PromptInputFileSchema,
  type PromptInputRefusal,
  PromptInputRefusalSchema,
} from "@repo/design-system/lib/prompt-input/files";
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

/**
 * Prompt text, the original files that one submission passes on, and the
 * refusals in the tray when the submission was pressed.
 */
const PromptInputSubmissionSchema = Schema.Struct({
  files: Schema.Array(PromptInputFileSchema),
  refusals: Schema.Array(PromptInputRefusalSchema),
  text: Schema.String,
});

/** Admits one submitted prompt; a false result keeps the draft in place. */
type PromptInputSubmitHandler<TEvent> = (
  message: PromptInputMessage,
  event: TEvent
) => boolean | Promise<boolean>;

/** Applies the local success state after the consumer admits a prompt. */
type PromptInputSuccessHandler = () => void;

/** Takes the refusals that a press was made with out of the tray. */
type PromptInputDismissHandler = (sent: readonly PromptInputRefusal[]) => void;

/**
 * Passes original files to the consumer and applies success state once. A press
 * that takes text or an accepted file takes its refusals out of the tray before
 * the consumer answers, so a refused file leaves whether or not the consumer
 * admits the message. A press that takes neither sends nothing, so it keeps them.
 */
export const submitPromptInput = Effect.fn("designSystem.promptInput.submit")(
  function* <TEvent>({
    dismissRefusals,
    event,
    files,
    onSubmit,
    onSuccess,
    refusals,
    text,
  }: typeof PromptInputSubmissionSchema.Type & {
    dismissRefusals: PromptInputDismissHandler;
    event: TEvent;
    onSubmit: PromptInputSubmitHandler<TEvent>;
    onSuccess: PromptInputSuccessHandler;
  }) {
    // A refusal picked after this press is not in `refusals`, so it stays for
    // the next message.
    if (text.trim() !== "" || files.length > 0) {
      yield* Effect.sync(() => dismissRefusals(refusals));
    }
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
