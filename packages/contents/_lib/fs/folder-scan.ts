import { ContentIO } from "@repo/contents/_lib/io/content";
import { DirectoryReadError } from "@repo/contents/_shared/error";
import { Effect } from "effect";

/** Reads recursive content-relative directory paths through Effect Platform. */
export function readContentDirectoryPaths(dirPath: string) {
  return ContentIO.readDirectory(dirPath, { recursive: true }).pipe(
    Effect.provide(ContentIO.Default),
    Effect.mapError(
      (cause) =>
        new DirectoryReadError({
          cause,
          message: "Unable to read content directory.",
          path: dirPath,
        })
    )
  );
}
