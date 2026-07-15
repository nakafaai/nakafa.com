import { Effect, Either, Schema } from "effect";

/** Runtime contract for one browser file download. */
export const FileDownloadRequest = Schema.Struct({
  content: Schema.Union(Schema.String, Schema.instanceOf(Blob)),
  filename: Schema.String,
  mimeType: Schema.String,
});

/** Schema-derived input accepted by the browser download program. */
export type FileDownloadRequest = Schema.Schema.Type<
  typeof FileDownloadRequest
>;

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
      catch: (cause) => cause,
    }).pipe(Effect.either);

    if (Either.isLeft(preparation)) {
      return yield* Effect.fail(downloadError(filename, preparation.left));
    }

    const { anchor, objectUrl } = preparation.right;
    const failures: unknown[] = [];
    const attachment = yield* Effect.try({
      try: () => {
        anchor.href = objectUrl;
        anchor.download = filename;
        document.body.append(anchor);
      },
      catch: (cause) => cause,
    }).pipe(Effect.either);

    if (Either.isLeft(attachment)) {
      failures.push(attachment.left);
    } else {
      const activation = yield* Effect.try({
        try: () => anchor.click(),
        catch: (cause) => cause,
      }).pipe(Effect.either);

      if (Either.isLeft(activation)) {
        failures.push(activation.left);
      }
    }

    const anchorCleanup = yield* Effect.try({
      try: () => anchor.remove(),
      catch: (cause) => cause,
    }).pipe(Effect.either);
    const objectUrlCleanup = yield* Effect.try({
      try: () => URL.revokeObjectURL(objectUrl),
      catch: (cause) => cause,
    }).pipe(Effect.either);

    if (Either.isLeft(anchorCleanup)) {
      failures.push(anchorCleanup.left);
    }
    if (Either.isLeft(objectUrlCleanup)) {
      failures.push(objectUrlCleanup.left);
    }
    if (failures.length > 0) {
      return yield* Effect.fail(downloadError(filename, failures[0]));
    }
  }
);
