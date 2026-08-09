import { Effect, Schema } from "effect";

const COPY_SOURCE_TIMEOUT = "10 seconds";

/** The reviewed source for one content page could not be copied. */
export class OpenContentCopyError extends Schema.TaggedError<OpenContentCopyError>()(
  "OpenContentCopyError",
  {
    code: Schema.Literal(
      "OPEN_CONTENT_SOURCE_MISSING",
      "OPEN_CONTENT_SOURCE_FETCH_FAILED",
      "OPEN_CONTENT_SOURCE_REJECTED",
      "OPEN_CONTENT_SOURCE_READ_FAILED",
      "OPEN_CONTENT_SOURCE_EMPTY",
      "OPEN_CONTENT_CLIPBOARD_FAILED"
    ),
    message: Schema.String,
  }
) {}

interface CopyOpenContentInput {
  readonly content?: string;
  readonly copySourceUrl?: null | string;
  readonly writeClipboard: (source: string) => Promise<void>;
}

/** Reads inline preview source or fetches one immutable published source. */
const readOpenContentCopySource = Effect.fn("www.openContent.readCopySource")(
  function* ({
    content,
    copySourceUrl,
  }: Pick<CopyOpenContentInput, "content" | "copySourceUrl">) {
    if (content) {
      return content;
    }

    if (!copySourceUrl) {
      return yield* new OpenContentCopyError({
        code: "OPEN_CONTENT_SOURCE_MISSING",
        message: "No reviewed content source is available to copy.",
      });
    }

    const response = yield* Effect.tryPromise({
      catch: () =>
        new OpenContentCopyError({
          code: "OPEN_CONTENT_SOURCE_FETCH_FAILED",
          message: "The reviewed content source could not be fetched.",
        }),
      try: (signal) => fetch(copySourceUrl, { signal }),
    });

    if (!response.ok) {
      return yield* new OpenContentCopyError({
        code: "OPEN_CONTENT_SOURCE_REJECTED",
        message: "The reviewed content source request was rejected.",
      });
    }

    const source = yield* Effect.tryPromise({
      catch: () =>
        new OpenContentCopyError({
          code: "OPEN_CONTENT_SOURCE_READ_FAILED",
          message: "The reviewed content source could not be read.",
        }),
      try: () => response.text(),
    });

    if (source.trim().length === 0) {
      return yield* new OpenContentCopyError({
        code: "OPEN_CONTENT_SOURCE_EMPTY",
        message: "The reviewed content source is empty.",
      });
    }

    return source;
  }
);

/** Loads the reviewed source on intent and waits for clipboard persistence. */
export const copyOpenContent = Effect.fn("www.openContent.copy")(function* (
  input: CopyOpenContentInput
) {
  const source = yield* readOpenContentCopySource(input).pipe(
    Effect.timeoutFail({
      duration: COPY_SOURCE_TIMEOUT,
      onTimeout: () =>
        new OpenContentCopyError({
          code: "OPEN_CONTENT_SOURCE_FETCH_FAILED",
          message: "The reviewed content source request timed out.",
        }),
    })
  );

  yield* Effect.tryPromise({
    catch: () =>
      new OpenContentCopyError({
        code: "OPEN_CONTENT_CLIPBOARD_FAILED",
        message: "The reviewed content source could not be copied.",
      }),
    try: () => input.writeClipboard(source),
  });
});
