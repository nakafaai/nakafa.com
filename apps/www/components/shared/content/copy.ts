import { Effect, Schema } from "effect";

const COPY_SOURCE_TIMEOUT = "10 seconds";
/** The reviewed source for a content page could not be copied. */
export class OpenContentCopyError extends Schema.TaggedError<OpenContentCopyError>()(
  "OpenContentCopyError",
  {
    code: Schema.Literals([
      "OPEN_CONTENT_SOURCE_MISSING",
      "OPEN_CONTENT_SOURCE_FETCH_FAILED",
      "OPEN_CONTENT_SOURCE_REJECTED",
      "OPEN_CONTENT_SOURCE_READ_FAILED",
      "OPEN_CONTENT_SOURCE_EMPTY",
      "OPEN_CONTENT_CLIPBOARD_FAILED",
    ]),
    message: Schema.String,
  }
) {}
const OpenContentCopySourceSchema = Schema.Struct({
  content: Schema.optionalKey(Schema.String),
  copySourceUrl: Schema.optionalKey(Schema.NullOr(Schema.String)),
});
type OpenContentCopySource = typeof OpenContentCopySourceSchema.Type;
/**
 * Loads the request module when a reader copies. It carries the HTTP client,
 * so a static import would add that client to the first JavaScript of every
 * content page, which `apps/www/e2e/budget/javascript.browser.ts` budgets.
 */
const loadSourceRequest = Effect.tryPromise({
  catch: () =>
    OpenContentCopyError.make({
      code: "OPEN_CONTENT_SOURCE_FETCH_FAILED",
      message: "The reviewed content source request could not be loaded.",
    }),
  try: () => import("@/components/shared/content/source"),
});
/** Reads inline preview source or fetches one immutable published source. */
export const readOpenContentCopySource = Effect.fn(
  "www.openContent.readCopySource"
)(
  function* ({ content, copySourceUrl }: OpenContentCopySource) {
    if (content) {
      return content;
    }
    if (!copySourceUrl) {
      return yield* OpenContentCopyError.make({
        code: "OPEN_CONTENT_SOURCE_MISSING",
        message: "No reviewed content source is available to copy.",
      });
    }
    const { requestOpenContentSource } = yield* loadSourceRequest;
    const source = yield* requestOpenContentSource(copySourceUrl);
    if (source.trim().length === 0) {
      return yield* OpenContentCopyError.make({
        code: "OPEN_CONTENT_SOURCE_EMPTY",
        message: "The reviewed content source is empty.",
      });
    }
    return source;
  },
  Effect.timeoutOrElse({
    duration: COPY_SOURCE_TIMEOUT,
    orElse: () =>
      Effect.fail(
        OpenContentCopyError.make({
          code: "OPEN_CONTENT_SOURCE_FETCH_FAILED",
          message: "The reviewed content source request timed out.",
        })
      ),
  })
);
/**
 * Hands the source to the clipboard as a promise where the browser accepts
 * one, and otherwise writes it once it has loaded.
 */
function writeClipboardSource(source: Promise<string>) {
  if (typeof ClipboardItem === "undefined") {
    return source.then((text) => navigator.clipboard.writeText(text));
  }
  const blob = source.then((text) => new Blob([text], { type: "text/plain" }));
  // A browser that throws on the lines below never reads this promise, so a
  // failed source is observed here. The write itself still reports it.
  blob.catch(() => undefined);
  return navigator.clipboard.write([new ClipboardItem({ "text/plain": blob })]);
}
/**
 * Writes the source of one copy to the clipboard. Run it inside the click
 * handler, before anything is awaited: Effect starts a fiber synchronously, so
 * the browser sees the write begin inside the click.
 *
 * A browser allows a clipboard write only for a short time after the click:
 * WebKit refuses one that starts more than five seconds later, and the source
 * may take up to ten. A clipboard item accepts its content as a promise, so
 * the write starts at once and keeps the click's permission while the source
 * loads. Firefox before version 127 has no `ClipboardItem`. A clipboard that
 * throws instead of rejecting fails the same typed way.
 *
 * @see https://webkit.org/blog/10855/async-clipboard-api/
 */
export function writeOpenContentCopy(source: Promise<string>) {
  return Effect.tryPromise({
    catch: () =>
      OpenContentCopyError.make({
        code: "OPEN_CONTENT_CLIPBOARD_FAILED",
        message: "The reviewed content source could not be copied.",
      }),
    try: () => writeClipboardSource(source),
  });
}
