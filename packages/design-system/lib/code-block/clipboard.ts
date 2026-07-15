import { Effect, Schema } from "effect";

const clipboardWriteSemaphore = Effect.unsafeMakeSemaphore(1);

/** Expected browser failure when the Clipboard API is unavailable. */
export class CodeClipboardUnavailableError extends Schema.TaggedError<CodeClipboardUnavailableError>()(
  "CodeClipboardUnavailableError",
  {
    message: Schema.String,
  }
) {}

/** Expected browser failure while writing code to the clipboard. */
export class CodeClipboardWriteError extends Schema.TaggedError<CodeClipboardWriteError>()(
  "CodeClipboardWriteError",
  {
    cause: Schema.Unknown,
    message: Schema.String,
  }
) {}

/** Writes one code sample through an injected browser clipboard boundary. */
export const writeCodeToClipboard = Effect.fn(
  "designSystem.codeBlock.writeClipboard"
)(function* (
  clipboard: Pick<Clipboard, "writeText"> | undefined,
  code: string
) {
  if (!clipboard?.writeText) {
    return yield* new CodeClipboardUnavailableError({
      message: "Clipboard API is not available in this browser.",
    });
  }

  return yield* clipboardWriteSemaphore.withPermits(1)(
    Effect.uninterruptible(
      Effect.tryPromise({
        try: () => clipboard.writeText(code),
        catch: (cause) =>
          new CodeClipboardWriteError({
            cause,
            message: "Failed to copy the code block to the clipboard.",
          }),
      })
    )
  );
});
