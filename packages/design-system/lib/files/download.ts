import { Array as Arr, Effect, Option, Result, Schema } from "effect";
/** Runtime contract for one browser file download. */
export const FileDownloadRequest = Schema.Struct({
  content: Schema.Union([Schema.String, Schema.instanceOf(Blob)]),
  filename: Schema.String,
  mimeType: Schema.String,
});
/** Schema-derived input accepted by the browser download program. */
export type FileDownloadRequest = typeof FileDownloadRequest.Type;
/** Expected browser failure while preparing, activating, or cleaning a download. */
export class BrowserFileDownloadError extends Schema.TaggedError<BrowserFileDownloadError>()(
  "BrowserFileDownloadError",
  {
    cause: Schema.Unknown,
    filename: Schema.String,
    message: Schema.String,
  }
) {}
function downloadError(filename: string, cause: unknown) {
  return new BrowserFileDownloadError({
    cause,
    filename,
    message: `Failed to download ${filename}.`,
  });
}
/** Downloads one file and guarantees removal of its temporary browser resources. */
export const downloadFile = Effect.fn("designSystem.files.download")(
  function* ({ content, filename, mimeType }: FileDownloadRequest) {
    const preparation = yield* Effect.try({
      try: () => {
        const anchor = document.createElement("a");
        const blob =
          typeof content === "string"
            ? new Blob([content], { type: mimeType })
            : content;
        return { anchor, objectUrl: URL.createObjectURL(blob) };
      },
      catch: (cause) => downloadError(filename, cause),
    }).pipe(Effect.result);
    if (Result.isFailure(preparation)) {
      return yield* preparation.failure;
    }
    const { anchor, objectUrl } = preparation.success;
    const attachment = yield* Effect.try({
      try: () => {
        anchor.href = objectUrl;
        anchor.download = filename;
        document.body.append(anchor);
      },
      catch: (cause) => downloadError(filename, cause),
    }).pipe(Effect.result);
    // A failed attachment is the step's failure. The click runs only after a
    // successful attachment.
    const activation = Result.isFailure(attachment)
      ? attachment
      : yield* Effect.try({
          try: () => anchor.click(),
          catch: (cause) => downloadError(filename, cause),
        }).pipe(Effect.result);
    const anchorCleanup = yield* Effect.try({
      try: () => anchor.remove(),
      catch: (cause) => downloadError(filename, cause),
    }).pipe(Effect.result);
    const objectUrlCleanup = yield* Effect.try({
      try: () => URL.revokeObjectURL(objectUrl),
      catch: (cause) => downloadError(filename, cause),
    }).pipe(Effect.result);
    const firstFailure = Arr.head(
      Arr.getFailures([activation, anchorCleanup, objectUrlCleanup])
    );
    if (Option.isSome(firstFailure)) {
      return yield* firstFailure.value;
    }
  }
);
