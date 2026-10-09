import { Effect, FileSystem, Path, Schema } from "effect";
import { CliStartupError } from "#cli/error";

export const REQUIRED_PACKED_FILES = [
  "LICENSE",
  "README.md",
  "dist/main.js",
  "package.json",
];

const PackageMetadataSchema = Schema.Struct({ version: Schema.String });

const toMetadataReadError = (cause: unknown) =>
  new CliStartupError({
    cause,
    message: "Unable to read the Nakafa CLI package metadata.",
  });

/** Reads and validates the version bundled with the installed CLI package. */
export const readPackageVersion = Effect.fn("NakafaCli.readPackageVersion")(
  function* (packageUrl: URL) {
    const fileSystem = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const packagePath = yield* path
      .fromFileUrl(packageUrl)
      .pipe(Effect.mapError(toMetadataReadError));
    const source = yield* fileSystem
      .readFileString(packagePath)
      .pipe(Effect.mapError(toMetadataReadError));
    const metadata = yield* Schema.decodeEffect(
      Schema.fromJsonString(PackageMetadataSchema)
    )(source).pipe(
      Effect.mapError(
        (cause) =>
          new CliStartupError({
            cause,
            message: "The Nakafa CLI package metadata is invalid.",
          })
      )
    );
    return metadata.version;
  }
);

/** Keeps source, tests, and workspace-only files out of the npm tarball. */
export function isAllowedPackedFile(path: string) {
  return (
    path === "LICENSE" ||
    path === "README.md" ||
    path === "package.json" ||
    path.startsWith("dist/")
  );
}
