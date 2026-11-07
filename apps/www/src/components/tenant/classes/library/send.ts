import { Data, Effect } from "effect";

/** R2 refused the upload or the connection dropped. */
export class UploadFailed extends Data.TaggedError("UploadFailed")<{
  readonly status: number;
}> {}

/**
 * Sends one file straight to its presigned R2 address, so its bytes never pass through the Worker or Convex. The
 * address binds the file's length and type, so the request sends the file's own type. `XMLHttpRequest` is the one
 * browser API that reports upload progress, which `onProgress` receives as a fraction from 0 to 1; interrupting the
 * effect aborts the upload.
 */
export const putLibraryFile = (
  address: string,
  file: File,
  onProgress: (fraction: number) => void
) =>
  Effect.callback<void, UploadFailed>((resume) => {
    const request = new XMLHttpRequest();
    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        onProgress(event.loaded / event.total);
      }
    });
    request.addEventListener("load", () => {
      resume(
        request.status >= 200 && request.status < 300
          ? Effect.void
          : Effect.fail(new UploadFailed({ status: request.status }))
      );
    });
    request.addEventListener("error", () => {
      resume(Effect.fail(new UploadFailed({ status: 0 })));
    });
    request.open("PUT", address);
    request.setRequestHeader("content-type", file.type);
    request.send(file);
    return Effect.sync(() => request.abort());
  });
